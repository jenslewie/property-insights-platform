class ModelServiceError(Exception):
    """Base exception for errors related to the model service."""


class ModelServiceUnavailableError(ModelServiceError):
    """Raised when the model service cannot be reached."""


class ModelServiceResponseError(ModelServiceError):
    """Raised when the model service returns an invalid or unsuccessful response."""
