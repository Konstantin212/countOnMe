"""Unit tests for app.services.auth — token generation, parsing, verification."""
from __future__ import annotations

import uuid

import pytest

from app.services.auth import (
    ParsedDeviceToken,
    _hash_secret,
    issue_device_token,
    parse_device_token,
    verify_device_token,
)


class TestIssueDeviceToken:
    """Tests for issue_device_token()."""

    def test_returns_token_and_hash(self) -> None:
        device_id = uuid.uuid4()
        token, token_hash = issue_device_token(device_id)

        assert isinstance(token, str)
        assert isinstance(token_hash, str)
        assert len(token) > 0
        assert len(token_hash) > 0

    def test_token_contains_device_id(self) -> None:
        device_id = uuid.uuid4()
        token, _ = issue_device_token(device_id)

        assert token.startswith(str(device_id))

    def test_token_format_is_device_id_dot_secret(self) -> None:
        device_id = uuid.uuid4()
        token, _ = issue_device_token(device_id)

        parts = token.split(".", 1)
        assert len(parts) == 2
        assert parts[0] == str(device_id)
        assert len(parts[1]) > 10  # Secret should be reasonably long

    def test_hash_is_not_raw_secret(self) -> None:
        device_id = uuid.uuid4()
        token, token_hash = issue_device_token(device_id)
        secret = token.split(".", 1)[1]

        assert token_hash != secret

    def test_different_calls_produce_different_tokens(self) -> None:
        device_id = uuid.uuid4()
        token1, hash1 = issue_device_token(device_id)
        token2, hash2 = issue_device_token(device_id)

        assert token1 != token2
        assert hash1 != hash2


class TestParseDeviceToken:
    """Tests for parse_device_token()."""

    def test_valid_token(self) -> None:
        device_id = uuid.uuid4()
        token, _ = issue_device_token(device_id)

        parsed = parse_device_token(token)

        assert parsed is not None
        assert isinstance(parsed, ParsedDeviceToken)
        assert parsed.device_id == device_id
        assert len(parsed.secret) > 0

    def test_invalid_format_no_dot(self) -> None:
        assert parse_device_token("no-dot-here") is None

    def test_invalid_format_bad_uuid(self) -> None:
        assert parse_device_token("not-a-uuid.some-secret") is None

    def test_empty_string(self) -> None:
        assert parse_device_token("") is None

    def test_only_dot(self) -> None:
        assert parse_device_token(".") is None


class TestVerifyDeviceToken:
    """Tests for verify_device_token()."""

    def test_correct_secret_verifies(self) -> None:
        device_id = uuid.uuid4()
        token, token_hash = issue_device_token(device_id)
        secret = token.split(".", 1)[1]

        assert verify_device_token(secret, token_hash) is True

    def test_wrong_secret_fails(self) -> None:
        device_id = uuid.uuid4()
        _, token_hash = issue_device_token(device_id)

        assert verify_device_token("wrong-secret", token_hash) is False

    def test_empty_secret_fails(self) -> None:
        device_id = uuid.uuid4()
        _, token_hash = issue_device_token(device_id)

        assert verify_device_token("", token_hash) is False

    def test_tampered_hash_fails(self) -> None:
        device_id = uuid.uuid4()
        token, _ = issue_device_token(device_id)
        secret = token.split(".", 1)[1]

        assert verify_device_token(secret, "tampered-hash") is False


class TestHashSecret:
    """Tests for _hash_secret() internals."""

    def test_same_secret_produces_same_hash(self) -> None:
        assert _hash_secret("test-secret") == _hash_secret("test-secret")

    def test_different_secrets_produce_different_hashes(self) -> None:
        assert _hash_secret("secret-a") != _hash_secret("secret-b")

    def test_hash_is_hex_string(self) -> None:
        result = _hash_secret("test")
        assert all(c in "0123456789abcdef" for c in result)
        assert len(result) == 64  # SHA-256 hex length


class TestRoundTrip:
    """End-to-end: issue → parse → verify."""

    @pytest.mark.parametrize("_run", range(3))
    def test_full_cycle(self, _run: int) -> None:
        device_id = uuid.uuid4()
        token, token_hash = issue_device_token(device_id)

        parsed = parse_device_token(token)
        assert parsed is not None
        assert parsed.device_id == device_id

        assert verify_device_token(parsed.secret, token_hash) is True
