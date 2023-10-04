import os
import pandas as pd
from sqlalchemy import create_engine, types
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Extract the database connection details from environment variables
DB_USERNAME = os.getenv("DB_USERNAME")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = "postgres"

# Load CSV into a pandas DataFrame
df = pd.read_csv('CWPP_Attributes.csv')

# Map pandas data types to PostgreSQL data types


def map_dtype(dtype):
    if "int" in str(dtype):
        return types.Integer()
    if "float" in str(dtype):
        return types.Float()
    if "datetime" in str(dtype):
        return types.DateTime()
    return types.String()


# Create a mapping of column names to PostgreSQL data types
dtype_dict = {col: map_dtype(df[col].dtype) for col in df.columns}

# Connect to your PostgreSQL instance using environment variables
engine = create_engine(
    f'postgresql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}')

# Create a new table and insert the data
df.to_sql('cwpp_long', engine, if_exists='replace',
          index=False, dtype=dtype_dict)
