from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import BaseTenant


class Jurisdiccion(BaseTenant):
    __tablename__ = "jurisdiccion"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
