from typing import Union

from fastapi import FastAPI
from routers.cost_estimation import router as cost_estimation_router

app = FastAPI()
app.include_router(cost_estimation_router, prefix="/cost-estimation", tags=["Cost Estimation"])

@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}