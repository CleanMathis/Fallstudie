from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

Database_URL =  "mysql+pymysql://'Nutzer':'Passwort'=@localhost:'Port'/'Name der Datenbank'"

engine = create_engine(Database_URL, echo=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# die zustäzlichen '' sind durch eigenen Variablen zu erstzen
