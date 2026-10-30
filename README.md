# Das ist die erste Aufgabe aus einer Fallstudie. 

## Aufgabe:
- Man soll KI teilweise einsetzen, um eine Webanwendug zu entwickeln. 
- Verschiedene Rollen, mit unterschiedlichen Funktionen
- Rollen bedingte Ansichten

## Voraussetzung
- Python 3.14
- Flask
- SQLAlchemy

## Struktur
```
db
|___entity
    |___api.py
    |___classes.py
    |___functions.py
    |___sqlcode.txt
|___ __init__.py
|___connection.py
UI
|___api.js
|___Login.html
|___styles.css
.gitignore
app.py
bsp.connection.py
```
## App nutzen:
1. Rollen in DB anlegen: admin, projektleiter, mitarbeiter, nutzer
2. Status anlegen: offen, Bearbeitung, Abgeschlossen
3. Benutzer anlegen: In der Datenbank direkt. Vorher einmal mit werkzeug.security generate_password_hash, das gewünschte Passwort hashen. 
4. App mittels ```python -m flask --app app run``` starten
