from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Public-facing user payload — used by /api/auth/me/ and embedded
    inside the login response so the frontend can route by role without
    a second roundtrip."""

    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "role")
        read_only_fields = fields


class TokenLoginSerializer(TokenObtainPairSerializer):
    """Adds `role` as a JWT claim and returns the user object alongside
    the token pair so the client can hydrate state in one call."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["username"] = user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class UserAdminSerializer(serializers.ModelSerializer):
    """Admin-facing user CRUD. Password is write-only and required on create
    but optional on update (omit to leave unchanged).
    """

    password = serializers.CharField(
        write_only=True, required=False, min_length=8, style={"input_type": "password"}
    )

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_active",
            "date_joined",
            "last_login",
            "password",
        )
        read_only_fields = ("id", "date_joined", "last_login")

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        if not password:
            raise serializers.ValidationError(
                {"password": "Password is required when creating a user."}
            )
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance
