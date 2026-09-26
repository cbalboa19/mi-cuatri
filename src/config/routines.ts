import type { RoutineDef } from '../domain/types';

// Rutinas de gym. Para cambiar un ejercicio edita su línea.
// - id: NO lo cambies si solo renombras el ejercicio (el historial y las gráficas van por id).
//   Si lo sustituyes por otro ejercicio distinto, ponle un id nuevo.
// - sets: series en fase normal (la app las ajusta según la fase del plan).
// - reps: [mínimo, máximo] del rango. Al hacer el máximo en todas las series, sugiere subir incrementKg.
// - restSec: descanso en segundos (arranca el temporizador al marcar una serie).
// - day: 0 = lunes ... 6 = domingo.

export const ROUTINES: RoutineDef[] = [
  {
    id: 'torso-a',
    name: 'Torso A',
    day: 0,
    desc: 'Fuerza-hipertrofia · ~75 min',
    exercises: [
      { id: 'bench-press', name: 'Press de banca con barra', sets: 4, reps: [5, 8], rir: '2', restSec: 180, incrementKg: 2.5 },
      { id: 'barbell-row', name: 'Remo con barra / pecho apoyado', sets: 4, reps: [6, 10], rir: '1-2', restSec: 150, incrementKg: 2.5 },
      { id: 'incline-db-press', name: 'Press inclinado mancuernas 30º', sets: 3, reps: [8, 12], rir: '1-2', restSec: 120, incrementKg: 2 },
      { id: 'lat-pulldown', name: 'Jalón al pecho', sets: 3, reps: [8, 12], rir: '1-2', restSec: 120, incrementKg: 2.5 },
      { id: 'db-lateral-raise', name: 'Elevaciones laterales mancuerna', sets: 3, reps: [12, 20], rir: '0-1', restSec: 90, incrementKg: 1 },
      { id: 'ez-curl', name: 'Curl con barra EZ', sets: 3, reps: [8, 12], rir: '1', restSec: 75, incrementKg: 2.5 },
      { id: 'rope-pushdown', name: 'Extensión tríceps polea (cuerda)', sets: 3, reps: [10, 15], rir: '1', restSec: 75, incrementKg: 2.5 },
    ],
  },
  {
    id: 'pierna-a',
    name: 'Pierna A',
    day: 1,
    desc: 'Cuádriceps · ~80 min',
    exercises: [
      { id: 'back-squat', name: 'Sentadilla con barra (o hack)', sets: 4, reps: [6, 10], rir: '2-3', restSec: 180, incrementKg: 5 },
      { id: 'romanian-deadlift', name: 'Peso muerto rumano', sets: 3, reps: [8, 10], rir: '2', restSec: 150, incrementKg: 5 },
      { id: 'leg-press', name: 'Prensa de piernas', sets: 3, reps: [10, 15], rir: '1-2', restSec: 120, incrementKg: 10 },
      { id: 'seated-leg-curl', name: 'Curl femoral sentado', sets: 3, reps: [10, 15], rir: '1', restSec: 90, incrementKg: 2.5 },
      { id: 'standing-calf-raise', name: 'Gemelos de pie', sets: 4, reps: [8, 15], rir: '1', restSec: 90, incrementKg: 5 },
      { id: 'cable-crunch', name: 'Crunch en polea alta', sets: 3, reps: [10, 15], rir: '1', restSec: 60, incrementKg: 2.5 },
    ],
  },
  {
    id: 'torso-b',
    name: 'Torso B',
    day: 2,
    desc: 'Hipertrofia · ~75 min',
    exercises: [
      { id: 'weighted-pullup', name: 'Dominadas lastradas', sets: 4, reps: [6, 10], rir: '1-2', restSec: 150, incrementKg: 2.5 },
      { id: 'seated-db-press', name: 'Press militar mancuernas sentado', sets: 3, reps: [6, 10], rir: '1-2', restSec: 120, incrementKg: 2 },
      { id: 'weighted-dip', name: 'Fondos lastrados / press inclinado máquina', sets: 3, reps: [8, 12], rir: '1-2', restSec: 120, incrementKg: 2.5 },
      { id: 'seated-cable-row', name: 'Remo en polea baja', sets: 3, reps: [10, 12], rir: '1', restSec: 120, incrementKg: 2.5 },
      { id: 'cable-fly', name: 'Aperturas en polea / contractor', sets: 2, reps: [12, 15], rir: '0-1', restSec: 90, incrementKg: 2.5 },
      { id: 'cable-lateral-raise', name: 'Elevaciones laterales en polea', sets: 3, reps: [12, 20], rir: '0-1', restSec: 60, incrementKg: 1 },
      { id: 'face-pull', name: 'Face pull', sets: 2, reps: [15, 20], rir: '1', restSec: 60, incrementKg: 2.5 },
      { id: 'incline-db-curl', name: 'Curl inclinado mancuernas', sets: 2, reps: [10, 15], rir: '1', restSec: 75, incrementKg: 1 },
      { id: 'ez-skullcrusher', name: 'Press francés barra EZ', sets: 2, reps: [10, 15], rir: '1', restSec: 75, incrementKg: 2.5 },
    ],
  },
  {
    id: 'pierna-b',
    name: 'Pierna B',
    day: 3,
    desc: 'Glúteo e isquios · ~80 min',
    exercises: [
      { id: 'hack-squat', name: 'Sentadilla hack / prensa', sets: 3, reps: [8, 12], rir: '1-2', restSec: 150, incrementKg: 5 },
      { id: 'hip-thrust', name: 'Hip thrust con barra', sets: 3, reps: [8, 12], rir: '1-2', restSec: 120, incrementKg: 5 },
      { id: 'bulgarian-split-squat', name: 'Sentadilla búlgara (por pierna)', sets: 3, reps: [8, 12], rir: '1-2', restSec: 90, incrementKg: 2 },
      { id: 'lying-leg-curl', name: 'Curl femoral tumbado', sets: 3, reps: [10, 15], rir: '1', restSec: 90, incrementKg: 2.5 },
      { id: 'leg-extension', name: 'Extensión de cuádriceps', sets: 3, reps: [12, 15], rir: '0-1', restSec: 60, incrementKg: 2.5 },
      { id: 'seated-calf-raise', name: 'Gemelos sentado', sets: 3, reps: [12, 20], rir: '1', restSec: 60, incrementKg: 5 },
      { id: 'hanging-leg-raise', name: 'Elevaciones de piernas colgado', sets: 3, reps: [10, 15], rir: '1', restSec: 60, incrementKg: 0 },
    ],
  },
];
