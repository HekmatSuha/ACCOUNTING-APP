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


class BankAccountViewSet(viewsets.ModelViewSet):
    """CRUD operations for bank accounts."""

    serializer_class = BankAccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.bank_accounts.all().order_by('name')

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        log_activity(self.request.user, 'created', instance)

    def perform_update(self, serializer):
        instance = serializer.save()
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

    def _create_transaction(self, *, account, transaction_type, amount, description='', related_account=None):
        transaction = BankAccountTransaction.objects.create(
            account=account,
            related_account=related_account,
            transaction_type=transaction_type,
            amount=amount,
            currency=account.currency,
            description=description or '',
            created_by=self.request.user,
        )
        return transaction

    @action(detail=True, methods=['post'])
    def deposit(self, request, pk=None):
        account = self.get_object()
        description = request.data.get('description', '')
        try:
            amount = self._parse_amount(request.data.get('amount'))
        except ValueError as exc:  # pragma: no cover - defensive programming
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        with db_transaction.atomic():
            BankAccount.objects.filter(pk=account.pk).update(balance=F('balance') + amount)
            account.refresh_from_db()
            transaction = self._create_transaction(
                account=account,
                transaction_type=BankAccountTransaction.DEPOSIT,
                amount=amount,
                description=description,
            )

        log_activity(
            request.user,
            'updated',
            account,
            description=f'Deposited {amount} {account.currency} into {account.name}.',
        )

        serializer = BankAccountTransactionSerializer(transaction)
        account_serializer = BankAccountSerializer(account)
        return Response(
            {
                'account': account_serializer.data,
                'transaction': serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        account = self.get_object()
        description = request.data.get('description', '')
        try:
            amount = self._parse_amount(request.data.get('amount'))
        except ValueError as exc:  # pragma: no cover - defensive programming
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        with db_transaction.atomic():
            BankAccount.objects.filter(pk=account.pk).update(balance=F('balance') - amount)
            account.refresh_from_db()
            transaction = self._create_transaction(
                account=account,
                transaction_type=BankAccountTransaction.WITHDRAWAL,
                amount=amount,
                description=description,
            )

        log_activity(
            request.user,
            'updated',
            account,
            description=f'Withdrew {amount} {account.currency} from {account.name}.',
        )

        serializer = BankAccountTransactionSerializer(transaction)
        account_serializer = BankAccountSerializer(account)
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
        target_id = request.data.get('target_account')
        description = request.data.get('description', '')

        try:
            target_id_int = int(target_id)
        except (TypeError, ValueError):
            return Response({'detail': 'A valid target_account is required for transfers.'}, status=status.HTTP_400_BAD_REQUEST)

        if target_id_int == source_account.pk:
            return Response({'detail': 'A different target_account is required for transfers.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_account = self.request.user.bank_accounts.get(pk=target_id_int)
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
                account=source_account,
                transaction_type=BankAccountTransaction.TRANSFER_OUT,
                amount=amount,
                description=description,
                related_account=target_account,
            )
            in_transaction = self._create_transaction(
                account=target_account,
                transaction_type=BankAccountTransaction.TRANSFER_IN,
                amount=amount,
                description=description,
                related_account=source_account,
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
