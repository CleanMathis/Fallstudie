from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from db import Base


class Person(Base):
    __tablename__ = 'person'
    person_id = Column(Integer, primary_key=True, index=True)
    vorname = Column(String(50), index=True)
    nachname = Column(String(50), index=True)
    email = Column(String(50), unique=True, index=True)
    rolle_id = Column(Integer, ForeignKey('rolle.rolle_id'))
    password = Column(String(255))
    rolle_rel = relationship("Rolle", backref="person")

class Aufgabe(Base):
    __tablename__ = 'aufgabe'

    aufgabe_id = Column(Integer, primary_key=True, index=True)
    titel = Column(String(50), index=True)
    beschreibung = Column(String(50), index=True)
    status = Column(Integer, ForeignKey('status.status_id'))
    projekt_id = Column(Integer, ForeignKey('projekt.projekt_id'))
    status_rel = relationship("Status", backref="aufgabe")
    projekt_rel = relationship("Projekt", backref="aufgabe")

class Projekt(Base):
    __tablename__ = 'projekt'

    projekt_id = Column(Integer, primary_key=True, index=True)
    titel = Column(String(50), index=True)
    beschreibung = Column(String(50), index=True)
    archiviert = Column(Boolean, default=False)

class Status(Base):
    __tablename__ = 'status'

    status_id = Column(Integer, primary_key=True, index=True)
    status = Column(String(50), index=True)

class Rolle(Base):
    __tablename__ = 'rolle'

    rolle_id = Column(Integer, primary_key=True, index=True)
    rolle = Column(String(50), index=True)

class ProjektMitarbeiter(Base):
    __tablename__ = 'projekt_mitarbeiter'

    pm_id = Column(Integer, primary_key=True, index=True)
    projekt_id = Column(Integer, ForeignKey('projekt.projekt_id'))
    person_id = Column(Integer, ForeignKey('person.person_id'))
    projekt_rel = relationship("Projekt", backref="projekt_mitarbeiter")
    person_rel = relationship("Person", backref="projekt_mitarbeiter")