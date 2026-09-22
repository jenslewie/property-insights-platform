from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    status: Literal["UP"] = Field(description="Current service health status.")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "UP",
            }
        }
    )
