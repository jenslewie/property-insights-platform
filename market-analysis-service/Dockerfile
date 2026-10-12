FROM maven:3.9.16-eclipse-temurin-21 AS builder

WORKDIR /workspace/market-analysis-service

COPY market-analysis-service/pom.xml ./

RUN --mount=type=cache,target=/root/.m2/repository mvn -DskipTests dependency:go-offline

COPY market-analysis-service/src ./src

RUN --mount=type=cache,target=/root/.m2/repository mvn -DskipTests package


FROM eclipse-temurin:21-jre AS runtime

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --system app && \
    useradd --system --gid app --home-dir /nonexistent app

COPY --from=builder --chown=app:app /workspace/market-analysis-service/target/market-analysis-service-0.1.0.jar ./app.jar
COPY --chown=app:app data/house-price-dataset.csv ./data/house-price-dataset.csv

USER app

EXPOSE 9002

HEALTHCHECK \
    --interval=30s \
    --timeout=3s \
    --start-period=10s \
    --retries=3 \
    CMD ["curl", "--fail", "--silent", "http://127.0.0.1:9002/health"]

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
