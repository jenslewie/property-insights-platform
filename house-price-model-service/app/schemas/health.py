from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "ok",
                "model_loaded": True,
            }
        }
    )
