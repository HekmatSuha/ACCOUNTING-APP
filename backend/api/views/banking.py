"""Bank account related API views."""

from decimal import Decimal, InvalidOperation

from django.db import transaction as db_transaction
from django.db.models import F
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..activity_logger import log_activity
from ..models import BankAccount, BankAccountTransaction
from ..serializers import BankAccountSerializer, BankAccountTransactionSerializer
from .utils import get_request_account


class BankAccountViewSet(viewsets.ModelViewSet):
    """CRUD operations for bank accounts."""

    serializer_class = BankAccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        account = get_request_account(self.request)
        return BankAccount.objects.filter(account=account).order_by('name')

    def perform_create(self, serializer):
        account = get_request_account(self.request)
        instance = serializer.save(created_by=self.request.user, account=account)
        log_activity(self.request.user, 'created', instance)

    def perform_update(self, serializer):
        account = get_request_account(self.request)
        instance = serializer.save(account=account)
        log_activity(self.request.user, 'updated', instance)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()

    @action(detail=True, methods=['get'])
    def transactions(self, request, pk=None):
        account = self.get_object()
        queryset = account.transactions.all()
        limit = request.query_params.get('limit')
        if limit is not None:
            try:
                limit_value = int(limit)
            except ValueError:
                return Response({'detail': 'limit must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)
            queryset = queryset[:max(0, limit_value)]
        serializer = BankAccountTransactionSerializer(queryset, many=True)
        return Response(serializer.data)

    def _parse_amount(self, amount):
        try:
            value = Decimal(amount)
        except (InvalidOperation, TypeError):
            raise ValueError('Amount must be a valid number.')
        if value <= 0:
            raise ValueError('Amount must be greater than zero.')
        return value.quantize(Decimal('0.01'))

    def _create_transaction(
        self,
        *,
        bank_account,
        transaction_type,
        amount,
        description='',
        related_account=None,
        account=None,
    ):
        owning_account = account or bank_account.account
        transaction = BankAccountTransaction.objects.create(
            bank_account=bank_account,
            related_account=related_account,
            transaction_type=transaction_type,
            amount=amount,
            currency=bank_account.currency,
            description=description or '',
            created_by=self.request.user,
            account=owning_account,
        )
        return transaction

    @action(detail=True, methods=['post'])
    def deposit(self, request, pk=None):
        bank_account = self.get_object()
        account = get_request_account(request)
        description = request.data.get('description', '')
        try:
            amount = self._parse_amount(request.data.get('amount'))
        except ValueError as exc:  # pragma: no cover - defensive programming
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        with db_transaction.atomic():
            BankAccount.objects.filter(pk=bank_account.pk).update(balance=F('balance') + amount)
            bank_account.refresh_from_db()
            transaction = self._create_transaction(
                bank_account=bank_account,
                transaction_type=BankAccountTransaction.DEPOSIT,
                amount=amount,
                description=description,
                account=account,
            )

        log_activity(
            request.user,
            'updated',
            bank_account,
            description=f'Deposited {amount} {bank_account.currency} into {bank_account.name}.',
        )

        serializer = BankAccountTransactionSerializer(transaction)
        account_serializer = BankAccountSerializer(bank_account)
        return Response(
            {
                'account': account_serializer.data,
                'transaction': serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        bank_account = self.get_object()
        account = get_request_account(request)
        description = request.data.get('description', '')
        try:
            amount = self._parse_amount(request.data.get('amount'))
        except ValueError as exc:  # pragma: no cover - defensive programming
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        with db_transaction.atomic():
            BankAccount.objects.filter(pk=bank_account.pk).update(balance=F('balance') - amount)
            bank_account.refresh_from_db()
            transaction = self._create_transaction(
                bank_account=bank_account,
                transaction_type=BankAccountTransaction.WITHDRAWAL,
                amount=amount,
                description=description,
                account=account,
            )

        log_activity(
            request.user,
            'updated',
            bank_account,
            description=f'Withdrew {amount} {bank_account.currency} from {bank_account.name}.',
        )

        serializer = BankAccountTransactionSerializer(transaction)
        account_serializer = BankAccountSerializer(bank_account)
        return Response(
            {
                'account': account_serializer.data,
                'transaction': serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def transfer(self, request, pk=None):
        source_account = self.get_object()
        account = get_request_account(request)
        target_id = request.data.get('target_account')
        description = request.data.get('description', '')

        try:
            target_id_int = int(target_id)
        except (TypeError, ValueError):
            return Response({'detail': 'A valid target_account is required for transfers.'}, status=status.HTTP_400_BAD_REQUEST)

        if target_id_int == source_account.pk:
            return Response({'detail': 'A different target_account is required for transfers.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_account = BankAccount.objects.get(pk=target_id_int, account=account)
        except BankAccount.DoesNotExist:
            return Response({'detail': 'Target account not found.'}, status=status.HTTP_404_NOT_FOUND)

        if target_account.currency != source_account.currency:
            return Response(
                {'detail': 'Accounts involved in a transfer must share the same currency.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            amount = self._parse_amount(request.data.get('amount'))
        except ValueError as exc:  # pragma: no cover - defensive programming
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        with db_transaction.atomic():
            BankAccount.objects.filter(pk=source_account.pk).update(balance=F('balance') - amount)
            BankAccount.objects.filter(pk=target_account.pk).update(balance=F('balance') + amount)

            source_account.refresh_from_db()
            target_account.refresh_from_db()

            out_transaction = self._create_transaction(
                bank_account=source_account,
                transaction_type=BankAccountTransaction.TRANSFER_OUT,
                amount=amount,
                description=description,
                related_account=target_account,
                account=account,
            )
            in_transaction = self._create_transaction(
                bank_account=target_account,
                transaction_type=BankAccountTransaction.TRANSFER_IN,
                amount=amount,
                description=description,
                related_account=source_account,
                account=account,
            )

        log_activity(
            request.user,
            'updated',
            source_account,
            description=f'Transferred {amount} {source_account.currency} to {target_account.name}.',
        )
        log_activity(
            request.user,
            'updated',
            target_account,
            description=f'Received transfer of {amount} {target_account.currency} from {source_account.name}.',
        )

        return Response(
            {
                'source_account': BankAccountSerializer(source_account).data,
                'target_account': BankAccountSerializer(target_account).data,
                'transactions': {
                    'source': BankAccountTransactionSerializer(out_transaction).data,
                    'target': BankAccountTransactionSerializer(in_transaction).data,
                },
            },
            status=status.HTTP_201_CREATED,
        )
