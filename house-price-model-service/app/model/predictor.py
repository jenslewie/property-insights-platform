from collections.abc import Sequence

import pandas as pd

from app.model.features import FEATURE_NAMES
from app.model.loader import get_model_bundle
from app.schemas.prediction import HousingFeatures


def predict_prices(items: Sequence[HousingFeatures]) -> list[float]:
    bundle = get_model_bundle()

    records = [item.model_dump() for item in items]

    dataframe = pd.DataFrame(records, columns=list(FEATURE_NAMES))

    predictions = bundle.model.predict(dataframe)

    return [round(float(prediction), 2) for prediction in predictions]
