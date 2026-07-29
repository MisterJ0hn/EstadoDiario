from typing import Optional

from sqlalchemy.orm import Session

from app.models.google_credencial import GoogleCredencial


class GoogleCredencialRepository:
    def __init__(self, db: Session):
        self.db = db

    def find_by_usuario(self, usuario_id: int) -> Optional[GoogleCredencial]:
        return (
            self.db.query(GoogleCredencial)
            .filter(GoogleCredencial.usuario_id == usuario_id)
            .first()
        )

    def upsert(self, usuario_id: int, google_email: str, refresh_token_cifrado: str) -> GoogleCredencial:
        cred = self.find_by_usuario(usuario_id)
        if cred is None:
            cred = GoogleCredencial(usuario_id=usuario_id)
            self.db.add(cred)
        cred.google_email = google_email
        cred.refresh_token_cifrado = refresh_token_cifrado
        self.db.commit()
        self.db.refresh(cred)
        return cred

    def delete(self, usuario_id: int) -> None:
        cred = self.find_by_usuario(usuario_id)
        if cred is not None:
            self.db.delete(cred)
            self.db.commit()
