from functools import wraps
from types import SimpleNamespace

from flask import Blueprint, jsonify, request, session
from sqlalchemy.exc import IntegrityError

from db import connection
from db.entity.functions import (
    archive_projekt,
    assign_person_to_projekt,
    change_aufgabe_status,
    create_aufgabe,
    create_person,
    create_projekt,
    edit_aufgabe,
    edit_person,
    edit_projekt,
    get_rolle,
    get_rolle_id,
    get_status_id,
    list_aufgaben,
    list_mitarbeiter,
    list_projekte,
    list_rolle,
    list_status,
    list_users,
    login,
)

bp = Blueprint("api", __name__, url_prefix="/api")


def api_route(required=(), login_required=True, json_body=True):
    """Gemeinsamer Ablauf für alle Routen.

    required:       Felder, die im JSON (bzw. in der URL) vorhanden sein müssen
    login_required: True = Nutzer muss eingeloggt sein
    json_body:      True = JSON-Body wird erwartet (POST),
                    False = keine Body-Pflicht, data = URL-Parameter (GET)

    Die dekorierte Funktion bekommt (db_session, current_user, data)
    und gibt nur ihr Ergebnis (jsonify, Statuscode) zurück.
    """
    def decorator(func):
        @wraps(func)
        def wrapper():
            if json_body:
                data = request.get_json(silent=True)
                if not data:
                    return jsonify({"message": "keine Daten erhalten"}), 400
            else:
                data = request.args.to_dict()

            fehlend = [feld for feld in required if not data.get(feld)]
            if fehlend:
                return jsonify({"message": "Fehlende Felder: " + ", ".join(fehlend)}), 400

            current_user = None
            if login_required:
                if "person_id" not in session:
                    return jsonify({"message": "Nicht eingeloggt"}), 401
                current_user = SimpleNamespace(
                    person_id=session["person_id"],
                    rolle=session["rolle"],
                )

            db_session = connection.SessionLocal()
            try:
                return func(db_session, current_user, data)
            except IntegrityError:
                db_session.rollback()
                return jsonify({"message": "Eintrag existiert bereits"}), 400
            except ValueError as e:
                return jsonify({"message": str(e)}), 400
            finally:
                db_session.close()
        return wrapper
    return decorator

#Login
@bp.route("/login", methods=["POST"])
@api_route(required=("email", "password"), login_required=False)
def login_route(db_session, current_user, data):
    try:
        person = login(db_session, email=data["email"], password=data["password"])
    except ValueError:
        return jsonify({"message": "Passwort oder E-Mail stimmen nicht"}), 401
    
    rolle = get_rolle(db_session, rolle_id=person.rolle_id)

    session.clear()

    session["person_id"] = person.person_id
    session["name"] = person.nachname
    session["rolle"] = rolle
    return jsonify({"person_id": person.person_id, "name": person.nachname, "rolle": rolle})

#Admin Funktionen Routen

@bp.route("/admin-create", methods=["POST"])
@api_route(required=("vorname", "nachname", "email", "password", "rolle"))
def create_user_route(db_session, current_user, data):
    rolle_id = get_rolle_id(db_session, data["rolle"])  # wirft ValueError, wenn die Rolle fehlt
    create_person(
        db_session,
        current_user=current_user,
        vorname=data["vorname"],
        nachname=data["nachname"],
        email=data["email"],
        rolle_id=rolle_id,
        password=data["password"],
    )
    return jsonify({"message": "Person wurde erstellt"}), 200

@bp.route("/admin-edit", methods=["POST"])
@api_route(required=("person_id",))
def edit_user_route(db_session, current_user, data):
    edit_person(
        db_session,
        current_user=current_user,
        person_id=data["person_id"],
        email=data.get("email"),
        rolle=data.get("rolle"),
        password=data.get("password")
    )
    return jsonify({"message": "Person wurde erfolgreich bearbeitet"}), 200

#Projektleiter Funktionen Routen
@bp.route("/project-create", methods=["POST"])
@api_route(required=("titel", "beschreibung"))
def create_project_route(db_session, current_user, data):
    projekt_id = create_projekt(
            db_session,
            current_user=current_user,
            titel=data["titel"], 
            beschreibung= data["beschreibung"]
    )
    return jsonify({"message": "Projekt erfolgreich erstellt", "projekt_id": projekt_id}), 200


@bp.route("/project-edit", methods=["POST"])
@api_route(required=("projekt_id","titel", "beschreibung"))
def edit_projekt_route(db_session, current_user, data):
    edit_projekt(
        db_session,
        current_user=current_user,
        projekt_id=data["projekt_id"],
        titel=data["titel"],
        beschreibung=data["beschreibung"]
        )
    return jsonify({"message": "Projekt erfolgreich bearbeitet"}), 200

@bp.route("/project-archive", methods=["POST"])
@api_route(required=("projekt_id",))
def archive_projekt_route(db_session, current_user, data):
    archive_projekt(db_session,
                    current_user=current_user,
                    projekt_id=data["projekt_id"]
                    )
    return jsonify({"message": "Projekt erfolgreich archiviert"}), 200

@bp.route("/person-to-project", methods=["POST"])
@api_route(required=("projekt_id", "person_id"))
def person_to_project_route(db_session, current_user, data):
    assign_person_to_projekt(db_session,
                            current_user=current_user,
                            projekt_id=data["projekt_id"],
                            person_id=data["person_id"]
                            )
    return jsonify({"message": "Person ist teil des Projekts"}), 200

#Mitarbeiter Funktionen Routen
@bp.route("/aufgabe-erstellen", methods=["POST"])
@api_route(required=("projekt_id", "titel", "beschreibung", "status"))
def create_aufgabe_route(db_session, current_user, data):
    status_id = get_status_id(db_session, status=data["status"])
    create_aufgabe(db_session,
                   current_user=current_user,
                   titel=data["titel"],
                   beschreibung=data["beschreibung"],
                   status_id=status_id,
                   projekt_id=data["projekt_id"]
                   )
    return jsonify({"message": "Aufgabe erfolgreich erstellt"}), 200

@bp.route("/aufgabe-bearbeiten", methods=["POST"])
@api_route(required=("aufgabe_id", "titel", "beschreibung", "projekt_id"))
def edit_aufgabe_route(db_session, current_user, data):
    edit_aufgabe(db_session, 
                current_user=current_user,
                aufgabe_id=data["aufgabe_id"],
                titel=data["titel"],
                beschreibung=data["beschreibung"],
                projekt_id= data["projekt_id"]
                )
    return jsonify({"message": "Aufgabe erfolgreich bearbeitet"}), 200

@bp.route("/aufgabe-status", methods=["POST"])
@api_route(required=("aufgabe_id", "status", "projekt_id"))
def change_aufgabe_status_route(db_session, current_user, data):
    status_id = get_status_id(db_session, status=data["status"])
    change_aufgabe_status(db_session,
                        current_user=current_user,
                        aufgabe_id=data["aufgabe_id"],
                        status_id=status_id,
                        projekt_id= data["projekt_id"]
                        )
    return jsonify({"message": "Status erfolgreich aktualisiert"}), 200

@bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Ausgeloggt"}), 200

#Visualisierung in der UI
@bp.route("/users", methods=["GET"])
@api_route(json_body=False)
def get_users(db_session, current_user, data):
    return jsonify(list_users(db_session, current_user=current_user)), 200


@bp.route("/persons", methods=["GET"])
@api_route(json_body=False)
def get_persons(db_session, current_user, data):
    return jsonify(list_mitarbeiter(db_session, current_user=current_user)), 200

@bp.route("/projects", methods=["GET"])
@api_route(json_body=False)
def get_projects(db_session, current_user, data):
    return jsonify(list_projekte(db_session, current_user=current_user)), 200

@bp.route("/tasks", methods=["GET"])
@api_route(required=("projekt_id",), json_body=False)
def get_tasks(db_session, current_user, data):
    return jsonify(list_aufgaben(db_session, current_user, data["projekt_id"])), 200

@bp.route("/status", methods=["GET"])
@api_route(json_body=False)
def get_status(db_session, current_user, data):
    return jsonify(list_status(db_session)), 200

@bp.route("/rolle", methods=["GET"])
@api_route(json_body=False)
def get_rolle_for_admin(db_session, current_user, data):
    return jsonify(list_rolle(db_session, current_user)), 200
