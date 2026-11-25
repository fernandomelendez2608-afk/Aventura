"""Los 100 animales: (clave, nombre en español, función que lo dibuja)."""
import random
import mammals1, mammals2, mammals3, custom_mammals, birds, herp_sea, bugs

MODS = [mammals1, mammals2, mammals3, custom_mammals, birds, herp_sea, bugs]

NAMES = [
    # mamíferos
    ("perro", "Perro"), ("gato", "Gato"), ("caballo", "Caballo"), ("vaca", "Vaca"), ("cerdo", "Cerdo"),
    ("elefante", "Elefante"), ("jirafa", "Jirafa"), ("leon", "León"), ("cebra", "Cebra"), ("oso", "Oso pardo"),
    ("conejo", "Conejo"), ("oveja", "Oveja"), ("burro", "Burro"), ("llama", "Llama"), ("cuy", "Cuy"),
    ("jaguar", "Jaguar"), ("puma", "Puma"), ("guepardo", "Guepardo"), ("tigre", "Tigre"), ("lobo", "Lobo"),
    ("zorro", "Zorro"), ("oso_polar", "Oso polar"), ("oso_anteojos", "Oso de anteojos"), ("panda", "Panda"),
    ("rinoceronte", "Rinoceronte"), ("hipopotamo", "Hipopótamo"), ("mono", "Mono"), ("mapache", "Mapache"),
    ("ciervo", "Ciervo"), ("bisonte", "Bisonte"), ("camello", "Camello"), ("jabali", "Jabalí"), ("raton", "Ratón"),
    ("capibara", "Capibara"), ("tapir", "Tapir"), ("oso_hormiguero", "Oso hormiguero"), ("armadillo", "Armadillo"),
    ("gorila", "Gorila"), ("orangutan", "Orangután"), ("koala", "Koala"), ("canguro", "Canguro"),
    ("ardilla", "Ardilla"), ("erizo", "Erizo"), ("murcielago", "Murciélago"), ("perezoso", "Perezoso"),
    ("suricata", "Suricata"), ("foca", "Foca"), ("morsa", "Morsa"), ("delfin", "Delfín"), ("ballena", "Ballena"),
    ("orca", "Orca"),
    # aves
    ("gallina", "Gallina"), ("gallo", "Gallo"), ("pato", "Pato"), ("cisne", "Cisne"), ("pavo", "Pavo"),
    ("paloma", "Paloma"), ("cuervo", "Cuervo"), ("buho", "Búho"), ("aguila", "Águila"), ("condor", "Cóndor"),
    ("guacamayo", "Guacamayo"), ("tucan", "Tucán"), ("flamenco", "Flamenco"), ("pinguino", "Pingüino"),
    ("colibri", "Colibrí"), ("pavo_real", "Pavo real"), ("gaviota", "Gaviota"), ("pelicano", "Pelícano"),
    ("avestruz", "Avestruz"), ("piquero", "Piquero patiazul"), ("canario", "Canario"),
    # reptiles, anfibios y vida marina
    ("tortuga_marina", "Tortuga marina"), ("tortuga_gigante", "Tortuga gigante"), ("serpiente", "Serpiente"),
    ("cocodrilo", "Cocodrilo"), ("iguana", "Iguana"), ("camaleon", "Camaleón"), ("rana", "Rana"),
    ("rana_dardo", "Rana dardo"), ("pez_payaso", "Pez payaso"), ("pez_globo", "Pez globo"), ("tiburon", "Tiburón"),
    ("pulpo", "Pulpo"), ("medusa", "Medusa"), ("cangrejo", "Cangrejo"), ("estrella_mar", "Estrella de mar"),
    ("caballito_mar", "Caballito de mar"), ("mantarraya", "Mantarraya"), ("langosta", "Langosta"),
    # insectos y arácnidos
    ("abeja", "Abeja"), ("mariposa", "Mariposa"), ("mariquita", "Mariquita"), ("hormiga", "Hormiga"),
    ("libelula", "Libélula"), ("arana", "Araña"), ("escorpion", "Escorpión"), ("caracol", "Caracol"),
    ("saltamontes", "Saltamontes"), ("escarabajo", "Escarabajo"),
]


def find(key):
    found = None
    for m in MODS:           # el último módulo que define la función gana
        if hasattr(m, key):
            found = getattr(m, key)
    if found is None:
        raise KeyError(key)
    return found


def ordered(seed=2026):
    """Mezcla fija para que números vecinos no sean del mismo tipo de animal."""
    items = list(NAMES)
    random.Random(seed).shuffle(items)
    return items
