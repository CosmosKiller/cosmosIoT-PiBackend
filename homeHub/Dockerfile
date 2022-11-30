FROM python:3.10.1-alpine3.15

WORKDIR /homeHub
COPY . .
RUN python -m pip install --upgrade pip
RUN pip install -r requirements.txt

CMD ["python3", "main.py"]