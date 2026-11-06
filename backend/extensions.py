"""Shared Flask extension instances.

Kept in their own module so models/routes can import `db` without importing
`app.py` (which caused a circular import / duplicate-`db` bug when running
`python app.py`).
"""
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
