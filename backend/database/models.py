from sqlalchemy import Column, Integer, String, create_engine, Float, DateTime, ForeignKey, JSON, Numeric
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./users.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    projects = relationship("Project", back_populates="user")

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    start_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Store estimation attributes as JSON
    attributes = Column(JSON)
    estimates = Column(JSON)
    
    # Budget and financial metrics
    initial_budget = Column(Numeric(10, 2), nullable=True)
    actual_cost = Column(Numeric(10, 2), nullable=True)
    expected_revenue = Column(Numeric(10, 2), nullable=True)
    discount_rate = Column(Numeric(5, 2), nullable=True)  # For NPV calculations
    cash_flows = Column(JSON)  # Store periodic cash flows for financial calculations
    budget_tracking = Column(JSON)  # Store budget tracking data
    financial_metrics = Column(JSON)  # Store calculated financial metrics
    
    # Relationship to user
    user = relationship("User", back_populates="projects")

# Create tables
Base.metadata.create_all(bind=engine)
