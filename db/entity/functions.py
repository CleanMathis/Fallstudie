from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from db.entity.classes import (
    Aufgabe,
    Person,
    Projekt,
    ProjektMitarbeiter,
    Rolle,
    Status,
)


#Admin Funktionen
def create_person(session, current_user, vorname, nachname, email, rolle_id, password):
    if current_user.rolle == "admin": #Berechtigungsprüfung, da nur Admin ein neues Benutzerkonto anlegen darf
        person = Person(vorname=vorname, nachname=nachname, email=email, rolle_id=rolle_id, password=hash_password(password))
        session.add(person) #fügt hinzu
        session.commit() #speichert in der Datenbank
        return person
    else:
        raise ValueError("Nur Admins dürfen nutzer anlegen.")

def edit_person(session, current_user,person_id, email, rolle, password):
    person = session.query(Person).filter_by(person_id=person_id).first()
    
    if person is None:
        raise ValueError("Person existiert nicht")

    if (rolle or email) and current_user.rolle != "admin":
        raise ValueError("Man muss Admin sein, um Rolle oder E-Mail ändern zu können")
    role = None
    if rolle:
        role = session.query(Rolle).filter_by(rolle=rolle).first()
        if role is None:
            raise ValueError("Rolle existier nicht")
    if person.person_id == current_user.person_id and password:
            person.password = hash_password(password)

    if role:
        person.rolle_id = role.rolle_id
    if email:     
        person.email = email

    try:
        session.commit()
    except (IntegrityError):
        session.rollback()
        raise ValueError("E-Mail existiert bereits")
    return person

#Projektleiter Funktionen
def create_projekt(session, current_user, titel, beschreibung):
    if current_user.rolle == "projektleiter":
        projekt = Projekt(titel=titel, beschreibung=beschreibung)
        session.add(projekt)
        session.commit()
        return projekt.projekt_id
    else:
        raise ValueError("Nur Projektleiter können Projekte anlegen.")

def edit_projekt(session, current_user, projekt_id, titel=None, beschreibung=None):
    projekt = session.query(Projekt).filter_by(projekt_id=projekt_id).first()
    if projekt is None:
        raise ValueError("Projekt nicht gefundem.")
    if current_user.rolle == "projektleiter":
        if titel:
            projekt.titel = titel
        if beschreibung:
            projekt.beschreibung = beschreibung
        session.commit()
        return projekt
    else:
        raise ValueError("Nur Projektleiter können Projekte bearbeiten.")

def archive_projekt(session, current_user, projekt_id):
    projekt = session.query(Projekt).filter_by(projekt_id=projekt_id).first()
    if projekt is None:
        raise ValueError("Projekt nicht gefunden.")
    if current_user.rolle == "projektleiter":
        projekt.archiviert = True
        session.commit()
        return projekt
    else:
        raise ValueError("Nur Projektleiter können Projekte archivieren.")

def assign_person_to_projekt(session, current_user, projekt_id, person_id):
    if current_user.rolle == "projektleiter":
        projekt_mitarbeiter = ProjektMitarbeiter(projekt_id=projekt_id, person_id=person_id)
        session.add(projekt_mitarbeiter)
        session.commit()
        return projekt_mitarbeiter
    else:
        raise ValueError("Nur Projektleiter können eine Person einem Projekt zuweisen.")

#Mitarbeiter Funktionen
def create_aufgabe(session, current_user, titel, beschreibung, status_id, projekt_id):
    if current_user.rolle != "mitarbeiter":
        raise ValueError("Nur Mitarbeiter sehen Aufgaben.")
    
    zugewiesen = (
    session.query(ProjektMitarbeiter)
    .filter_by(projekt_id=projekt_id, person_id=current_user.person_id)
    .first()
    )
    if zugewiesen is None:
        raise ValueError("Du bist diesem Projekt nicht zugewiesen.")
    

    aufgabe = Aufgabe(titel=titel, beschreibung=beschreibung, status=status_id, projekt_id=projekt_id)
    session.add(aufgabe)
    session.commit()
    return aufgabe

    
def edit_aufgabe(session, current_user, aufgabe_id, projekt_id, titel=None, beschreibung=None):
    if current_user.rolle != "mitarbeiter":
        raise ValueError("Nur Mitarbeiter sehen Aufgaben.")

    zugewiesen = (
    session.query(ProjektMitarbeiter)
    .filter_by(projekt_id=projekt_id, person_id=current_user.person_id)
    .first()
    )
    if zugewiesen is None:
        raise ValueError("Du bist diesem Projekt nicht zugewiesen.")
    
    aufgabe = session.query(Aufgabe).filter_by(aufgabe_id=aufgabe_id).first()
    if aufgabe is None:
        raise ValueError("Aufgabe nicht gefunden.")
    if titel:
        aufgabe.titel = titel
    if beschreibung:
        aufgabe.beschreibung = beschreibung
    session.commit()
    return aufgabe


def change_aufgabe_status(session, current_user, aufgabe_id, status_id, projekt_id):
    """Aufgaben eines Projekts, nur für zugewiesene mitarbeiter."""
    if current_user.rolle != "mitarbeiter":
        raise ValueError("Nur Mitarbeiter sehen Aufgaben.")

    try:
        projekt_id = int(projekt_id)
    except (TypeError, ValueError):
        raise ValueError("projekt_id muss eine Zahl sein.")

    # Ist der Mitarbeiter diesem Projekt zugewiesen?
    zugewiesen = (
        session.query(ProjektMitarbeiter)
        .filter_by(projekt_id=projekt_id, person_id=current_user.person_id)
        .first()
    )
    if zugewiesen is None:
        raise ValueError("Du bist diesem Projekt nicht zugewiesen.")

    aufgabe = session.query(Aufgabe).filter_by(aufgabe_id=aufgabe_id).first()
    if aufgabe is None:
        raise ValueError("Aufgabe nicht gefunden.")

    aufgabe.status = status_id
    session.commit()
    return aufgabe

#Hilfsfunktionen
def get_rolle_id(session, rolle):
    rolle = session.query(Rolle).filter_by(rolle=rolle).first()
    if rolle is None:
        raise ValueError("Rolle nicht gefunden.")
    return rolle.rolle_id

def get_person_id(session, nachname):
    person = session.query(Person).filter_by(nachname=nachname).first()
    if person is None:
        raise ValueError("Person nicht gefunden.")
    return person.person_id

def get_projekt_id(session, titel):
    projekt = session.query(Projekt).filter_by(titel=titel).first()
    if projekt is None:
        raise ValueError("Projekt nicht gefunden.")
    return projekt.projekt_id

def get_aufgabe_id(session, titel):
    aufgabe = session.query(Aufgabe).filter_by(titel=titel).first()
    if aufgabe is None:
        raise ValueError("Aufgabe nicht gefunden.")
    return aufgabe.aufgabe_id

def get_status_id(session, status):
    status = session.query(Status).filter_by(status=status).first()
    if status is None:
        raise ValueError("Status nicht gefunden.")
    return status.status_id

def hash_password(password):
    return generate_password_hash(password)

def verify_password_hash(stored_password, provided_password):
    return check_password_hash(stored_password, provided_password)

def login(session, email, password):
    person = session.query(Person).filter_by(email=email).first()
    if person is None or not verify_password_hash(person.password, password):
        raise ValueError("Invalide E-Mail oder Passwort.")
    return person

def get_rolle(session, rolle_id):
    rolle_objekt = session.query(Rolle).filter_by(rolle_id=rolle_id).first()
    if rolle_objekt is None:
        raise ValueError("ist keine rollen_id")
    return rolle_objekt.rolle

#Visualisierungs Funktionen
def list_users(session, current_user):
    """Alle Personen für die Admin-Tabelle (ohne Passwort)."""
    if current_user.rolle != "admin":
        raise ValueError("Nur Admins dürfen alle Benutzer sehen.")

    personen = session.query(Person).order_by(Person.nachname).all()
    return [
        {
            "person_id": p.person_id,
            "vorname": p.vorname,
            "nachname": p.nachname,
            "email": p.email,
            # Rollenname über die Beziehung, nicht die rolle_id
            "rolle": p.rolle_rel.rolle if p.rolle_rel else "",
        }
        for p in personen
    ]


def list_mitarbeiter(session, current_user):
    """Nur erlaubte Rollen, für das Zuweisen-Dropdown des Projektleiters."""
    if current_user.rolle != "projektleiter":
        raise ValueError("Nur Projektleiter dürfen Mitarbeiter auflisten.")

    erlaubte_rollen = ["nutzer", "mitarbeiter"]
    personen = (
        session.query(Person)
        .join(Rolle, Person.rolle_id == Rolle.rolle_id)
        .filter(Rolle.rolle.in_(erlaubte_rollen))
        .order_by(Person.nachname)
        .all()
    )
    return [
        {
            "person_id": p.person_id,
            "vorname": p.vorname,
            "nachname": p.nachname,
        }
        for p in personen
    ]


def list_projekte(session, current_user):
    """projektleiter: alle aktiven Projekte. mitarbeiter: nur zugewiesene."""
    # Archivierte Projekte werden nicht angezeigt
    query = session.query(Projekt).filter(Projekt.archiviert.is_(False))

    if current_user.rolle == "projektleiter":
        pass  # sieht alle
    elif current_user.rolle == "mitarbeiter" or current_user.rolle == "nutzer":
        query = query.join(
            ProjektMitarbeiter,
            ProjektMitarbeiter.projekt_id == Projekt.projekt_id,
        ).filter(ProjektMitarbeiter.person_id == current_user.person_id)
    else:
        raise ValueError("Keine Berechtigung für Projekte.")

    projekte = query.order_by(Projekt.titel).all()
    return [
        {
            "projekt_id": p.projekt_id,
            "titel": p.titel,
            "beschreibung": p.beschreibung,
            "status": "aktiv",  # archivierte werden oben schon herausgefiltert
        }
        for p in projekte
    ]


def list_aufgaben(session, current_user, projekt_id):
    """Aufgaben eines Projekts, nur für zugewiesene Personen."""
    try:
        projekt_id = int(projekt_id)
    except (TypeError, ValueError):
        raise ValueError("projekt_id muss eine Zahl sein.")
    if current_user.rolle == "projektleiter":

        projekt = (
            session.query(Projekt)
            .filter_by(projekt_id=projekt_id)
            .first()
        )

        if projekt is None:
            raise ValueError("Das Projekt existiert nicht.")

    elif current_user.rolle == "mitarbeiter" or current_user.rolle == "nutzer":

        # Ist der Mitarbeiter diesem Projekt zugewiesen?
        zugewiesen = (
            session.query(ProjektMitarbeiter)
            .filter_by(projekt_id=projekt_id, person_id=current_user.person_id)
            .first()
        )
        if zugewiesen is None:
            raise ValueError("Du bist diesem Projekt nicht zugewiesen.")
    else:
        raise ValueError("Du bist nicht berechtigt, um die Aufgaben zu sehen")

    aufgaben = (
        session.query(Aufgabe)
        .filter_by(projekt_id=projekt_id)
        .order_by(Aufgabe.aufgabe_id)
        .all()
    )
    return [
        {
            "aufgabe_id": a.aufgabe_id,
            "titel": a.titel,
            "beschreibung": a.beschreibung,
            # Statusname statt Status-ID, die Auswahlliste arbeitet mit Namen
            "status": a.status_rel.status if a.status_rel else "",
        }
        for a in aufgaben
    ]


def list_status(session):
    """Alle Statusnamen für die Auswahllisten (Reihenfolge nach ID)."""
    return [s.status for s in session.query(Status).order_by(Status.status_id).all()]

def list_rolle(session, current_user):
    
    """Alle Rollen für die Auswahllisten (Reihenfolge nach ID)."""
    if current_user.rolle == "admin":
        return [r.rolle for r in session.query(Rolle).order_by(Rolle.rolle_id).all()]
    else:
        raise ValueError("Nur ein Admin darf die Rollen sehen.")