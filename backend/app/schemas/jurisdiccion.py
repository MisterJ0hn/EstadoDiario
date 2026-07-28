from pydantic import BaseModel, Field


class JurisdiccionResponse(BaseModel):
    id: int
    nombre: str

    class Config:
        from_attributes = True


class JurisdiccionCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=255)


class JurisdiccionListResponse(BaseModel):
    exito: bool = True
    total: int
    jurisdicciones: list[JurisdiccionResponse]
