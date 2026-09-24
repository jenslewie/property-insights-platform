package com.propertyinsights.marketanalysis.error;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public final class ApiExceptionHandler {

  private static final Logger LOGGER = LoggerFactory.getLogger(ApiExceptionHandler.class);

  @ExceptionHandler(ApiException.class)
  public ResponseEntity<ProblemDetail> handle(ApiException error) {
    LOGGER
        .atWarn()
        .addKeyValue("event", "api_request_rejected")
        .addKeyValue("status", error.status().value())
        .addKeyValue("error_type", error.getClass().getSimpleName())
        .setCause(error)
        .log("API request rejected");

    return response(error.status(), error.getMessage());
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ProblemDetail> handleUnreadableRequest(
      HttpMessageNotReadableException error) {
    LOGGER
        .atWarn()
        .addKeyValue("event", "api_request_rejected")
        .addKeyValue("status", HttpStatus.UNPROCESSABLE_ENTITY.value())
        .addKeyValue("error_type", error.getClass().getSimpleName())
        .setCause(error)
        .log("Request body is malformed or unreadable");

    return response(HttpStatus.UNPROCESSABLE_ENTITY, "Malformed or unreadable JSON request body.");
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ProblemDetail> handleUnexpected(Exception error) {
    if (error instanceof ErrorResponse frameworkError
        && frameworkError.getStatusCode().is4xxClientError()) {
      LOGGER
          .atWarn()
          .addKeyValue("event", "api_request_rejected")
          .addKeyValue("status", frameworkError.getStatusCode().value())
          .addKeyValue("error_type", error.getClass().getSimpleName())
          .setCause(error)
          .log("API request rejected");

      return response(
          frameworkError.getStatusCode(),
          "Invalid or unsupported request.",
          frameworkError.getHeaders());
    }

    LOGGER
        .atError()
        .addKeyValue("event", "api_unexpected_error")
        .addKeyValue("status", HttpStatus.INTERNAL_SERVER_ERROR.value())
        .addKeyValue("error_type", error.getClass().getSimpleName())
        .setCause(error)
        .log("Unexpected API failure");

    return response(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred.");
  }

  private ResponseEntity<ProblemDetail> response(HttpStatusCode status, String detail) {
    return response(status, detail, new HttpHeaders());
  }

  private ResponseEntity<ProblemDetail> response(
      HttpStatusCode status, String detail, HttpHeaders headers) {
    ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);

    return ResponseEntity.status(status)
        .headers(headers)
        .contentType(MediaType.parseMediaType("application/problem+json"))
        .body(body);
  }
}
