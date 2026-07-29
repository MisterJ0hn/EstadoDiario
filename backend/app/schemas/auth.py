from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, examples=["admin"])
    password: str = Field(..., min_length=1, examples=["admin123"])


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserInfo(BaseModel):
    id: int
    username: str
    email: str
    nombre: str | None
    apellido: str | None
    telefono: str | None = None
    rol: str
    activo: bool

    class Config:
        from_attributes = True


class ActualizarPerfilRequest(BaseModel):
    """Autoservicio: solo el propio teléfono, no email/rol/password."""

    telefono: str | None = Field(default=None, max_length=30)
