from decimal import Decimal
from unittest.mock import Mock, patch
import requests

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

from ..exchange_rates import get_exchange_rate


class GetExchangeRateTests(SimpleTestCase):
    def setUp(self):
        super().setUp()
        cache.clear()

    def tearDown(self):
        cache.clear()
        super().tearDown()

    @override_settings(
        EXCHANGE_RATE_API_URL="https://example.com/rates",
        EXCHANGE_RATE_API_KEY="test_key",
    )
    @patch("api.exchange_rates.requests.get")
    def test_fetches_rate_from_configured_url(self, mock_get: Mock) -> None:
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {
            "success": True,
            "quotes": {"USDEUR": 1.1},
        }
        mock_get.return_value = response

        rate = get_exchange_rate("USD", "EUR")

        self.assertEqual(rate, Decimal("1.1"))
        mock_get.assert_called_once_with(
            "https://example.com/rates",
            params={"base": "USD", "symbols": "EUR", "access_key": "test_key"},
            timeout=10,
        )

    @patch("api.exchange_rates.requests.get")
    def test_fetches_rate_from_rates_mapping(self, mock_get: Mock) -> None:
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {
            "success": True,
            "rates": {"EUR": 0.92},
        }
        mock_get.return_value = response

        rate = get_exchange_rate("USD", "EUR")

        self.assertEqual(rate, Decimal("0.92"))
        mock_get.assert_called_once()
        _, kwargs = mock_get.call_args
        self.assertEqual(
            kwargs["params"],
            {"base": "USD", "symbols": "EUR"},
        )

    @override_settings(EXCHANGE_RATE_API_URL="https://example.com/rates")
    @patch("api.exchange_rates.requests.get")
    def test_raises_error_if_api_key_is_missing(self, mock_get: Mock) -> None:
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {
            "success": False,
            "error": {
                "code": 101,
                "type": "missing_access_key",
                "info": "You have not supplied an API Access Key.",
            },
        }
        mock_get.return_value = response

        with self.assertRaisesMessage(ValueError, "Exchange rate API returned error: You have not supplied an API Access Key."):
            get_exchange_rate("USD", "EUR")

        mock_get.assert_called_once_with(
            "https://example.com/rates",
            params={"base": "USD", "symbols": "EUR"},
            timeout=10,
        )

    @patch("api.exchange_rates.requests.get", side_effect=requests.exceptions.RequestException("boom"))
    def test_returns_manual_rate_when_request_fails(self, mock_get: Mock) -> None:
        with self.assertLogs("api.exchange_rates", level="ERROR") as captured:
            rate = get_exchange_rate("USD", "EUR", manual_rate=1.23)

        self.assertEqual(rate, Decimal("1.23"))
        self.assertTrue(any("Failed to fetch exchange rate" in msg for msg in captured.output))
        self.assertEqual(cache.get("exchange_rate_USD_EUR"), Decimal("1.23"))
        mock_get.assert_called_once()

    @patch("api.exchange_rates.requests.get")
    def test_returns_manual_rate_when_response_missing_currency(self, mock_get: Mock) -> None:
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"success": True, "motd": {"msg": "ok"}}
        mock_get.return_value = response

        with self.assertLogs("api.exchange_rates", level="ERROR") as captured:
            rate = get_exchange_rate("USD", "EUR", manual_rate=1.5)

        self.assertEqual(rate, Decimal("1.5"))
        self.assertTrue(any("Failed to fetch exchange rate" in msg for msg in captured.output))
        self.assertEqual(cache.get("exchange_rate_USD_EUR"), Decimal("1.5"))
        mock_get.assert_called_once()

    @patch("api.exchange_rates.requests.get", side_effect=requests.exceptions.RequestException("boom"))
    def test_raises_runtime_error_when_no_fallback_available(self, mock_get: Mock) -> None:
        with self.assertLogs("api.exchange_rates", level="ERROR"):
            with self.assertRaises(RuntimeError):
                get_exchange_rate("USD", "EUR")

        mock_get.assert_called_once()

    @patch("api.exchange_rates.requests.get")
    def test_raises_runtime_error_when_response_missing_currency(self, mock_get: Mock) -> None:
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"success": True}
        mock_get.return_value = response

        with self.assertLogs("api.exchange_rates", level="ERROR"):
            with self.assertRaises(RuntimeError):
                get_exchange_rate("USD", "EUR")

        mock_get.assert_called_once()
