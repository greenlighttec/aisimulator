# Use official Python image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set working directory
WORKDIR /app

# Copy dependencies
COPY backend/requirements.txt .

# Install dependencies
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy the backend code
COPY backend/. .

# Expose Flask port
EXPOSE 5000

# Use Gunicorn to run the app in production mode
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "ai_server:app"]
