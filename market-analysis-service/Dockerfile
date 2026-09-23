FROM maven:3.9.16-eclipse-temurin-21 AS build

WORKDIR /workspace/market-analysis-service

COPY market-analysis-service/pom.xml ./
COPY market-analysis-service/src ./src

RUN mvn -q -DskipTests package


FROM eclipse-temurin:21-jre

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY --from=build /workspace/market-analysis-service/target/market-analysis-service-0.1.0.jar app.jar

COPY data/house-price-dataset.csv /app/data/house-price-dataset.csv

EXPOSE 9002

HEALTHCHECK \
    --interval=30s \
    --timeout=3s \
    --start-period=10s \
    --retries=3 \
    CMD curl --fail --silent http://127.0.0.1:9002/health || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]