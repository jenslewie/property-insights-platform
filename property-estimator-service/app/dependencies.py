from fastapi import Request

from app.services.estimate_service import EstimateService


def get_estimate_service(request: Request) -> EstimateService:
    return EstimateService(house_price_client=request.app.state.house_price_client)
