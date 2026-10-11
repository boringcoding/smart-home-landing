import type { RoomId } from '../types';

export type Vec3 = [number, number, number];
export type ElectricalStatus = 'planned' | 'reserve' | 'optional' | 'coordination';
export type ElectricalKind = 'socket' | 'switch' | 'light' | 'ethernet' | 'sensor' | 'panel' | 'load' | 'curtain' | 'emergency';
export type RouteKind = 'power' | 'lighting' | 'signal' | 'ethernet' | 'rs485';
export interface ButtonKey { key:number; label:string; targets:string[]; action:'toggle'|'away'|'night'|'reserve'; requiresWB:boolean; longPress?:{label:string;targets:string[]} }
export interface ElectricalPoint {
  id:string; kind:ElectricalKind; room:RoomId; label:string;
  position:Vec3|null; normal:Vec3; circuits:string[]; status:ElectricalStatus; note:string;
  planPosition?:[number,number]|null; heightNote?:string; mounting?:string;
  sockets?:number; ports?:number; lightGroup?:string; controls?:string[]; keys?:ButtonKey[];
  mounts?:{position:Vec3;normal:Vec3;sockets?:number;ports?:number}[];
  sourceRef:string; sourceGuids?:string[];
}
export interface ElectricalRoute { id:string; kind:RouteKind; points:Vec3[]; circuits:string[]; pointIds:string[]; note:string; conceptual:true }
export interface LightGroup { id:string; label:string; room:RoomId; circuit:string; module:'A'|'B'|'C'; channel:number; pointId:string; controlledBy:string[]; note:string }
export interface Circuit { id:string; label:string; status:ElectricalStatus; note:string; sourceCableNote:string; sourceProtectionNote:string }
export interface NetworkLink { id:string; pointId:string; port:string; panelId:string; routeId:string; role:string }




// Restored data with IFC-aware visualization placements. See docs/electrical-source.json.
export const ELECTRICAL_SOURCE = {
  "title": "Схема умного дома — восстановленные таблицы электрики",
  "threadId": "6acb52a6-8790-832a-89a7-0da9c48150a1",
  "url": "https://chatgpt.com/c/6acb52a6-8790-832a-89a7-0da9c48150a1",
  "date": "2026-10-11",
  "status": "Предпроектная схема. Не рабочая документация для монтажа.",
  "coordinateSystem": "Plan (u,v,h) → glTF (u−4,h,v−3.25); IFC (u+4.292172,−v−0.477273,h). Metres, Y-up glTF.",
  "counts": {
    "socketBlocks": 26,
    "sockets": 58,
    "lightGroups": 14,
    "switchPosts": 10,
    "ethernetPoints": 8,
    "ethernetRuns": 15,
    "circuits": 25
  },
  "notes": [
    "Кабинет соответствует bedroom_west; спальня bedroom_east. Подтверждено исходной мебелью IFC.",
    "Восстановлены последние правки design_data.py; не только первая версия таблиц.",
    "Отделка, шторы с ручными подхватами, матовое окно санузла, мебель и геометрия GLB сохранены.",
    "Монтажные позиции эскизные. Неопределённые санузловые розетки и подключения оставлены без 3D-координат.",
    "14 групп — обычное раздельное переключение. Диммирование требует совместимых приборов; демонстрация уровня яркости не задаёт реальный драйвер."
  ]
};

export const ELECTRICAL_POINTS: ElectricalPoint[] = [
  {
    "id": "R01",
    "kind": "socket",
    "room": "bedroom_west",
    "label": "Рабочий стол: два блока по три гнезда",
    "position": [
      -3.05,
      0.3,
      -3.06
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q04"
    ],
    "status": "planned",
    "note": "Предварительное размещение; уточняется по мебели и выбранной арматуре.",
    "planPosition": [
      0.95,
      0.17
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R01",
    "sockets": 6,
    "heightNote": "0,30 либо под столешницей с доступом",
    "mounting": "wall",
    "mounts": [
      {
        "position": [
          -3.2,
          0.3,
          -3.06
        ],
        "normal": [
          0,
          0,
          1
        ],
        "sockets": 3
      },
      {
        "position": [
          -2.85,
          0.3,
          -3.06
        ],
        "normal": [
          0,
          0,
          1
        ],
        "sockets": 3
      }
    ]
  },
  {
    "id": "R02",
    "kind": "socket",
    "room": "bedroom_west",
    "label": "Над столом для зарядок и временной техники",
    "position": [
      -1.95,
      1.05,
      -3.06
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q04"
    ],
    "status": "planned",
    "note": "Предварительное размещение; уточняется по мебели и выбранной арматуре.",
    "planPosition": [
      2.05,
      0.17
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R02",
    "sockets": 2,
    "heightNote": "1,00-1,10, по высоте стола",
    "mounting": "wall"
  },
  {
    "id": "R03",
    "kind": "socket",
    "room": "bedroom_west",
    "label": "У подлокотника дивана, вне его спинки",
    "position": [
      -3.6,
      0.3,
      -0.66018
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "circuits": [
      "Q04"
    ],
    "status": "planned",
    "note": "Предварительное размещение; уточняется по мебели и выбранной арматуре.",
    "planPosition": [
      0.4,
      2.39
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R03",
    "sockets": 2,
    "heightNote": "0,30; при тумбе выше ее на 0,15",
    "mounting": "wall"
  },
  {
    "id": "R04",
    "kind": "socket",
    "room": "bedroom_west",
    "label": "Сервисный блок под окном на левой стене",
    "position": [
      -3.81018,
      0.3,
      -1.77
    ],
    "normal": [
      1,
      0,
      0
    ],
    "circuits": [
      "Q04"
    ],
    "status": "planned",
    "note": "Предварительное размещение; уточняется по мебели и выбранной арматуре.",
    "planPosition": [
      0.18,
      1.48
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R04",
    "sockets": 2,
    "heightNote": "0,30; только после увязки с радиатором",
    "mounting": "wall"
  },
  {
    "id": "R05",
    "kind": "socket",
    "room": "bedroom_east",
    "label": "Левая тумба у изголовья",
    "position": [
      0.98,
      0.65,
      -3.06
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q05"
    ],
    "status": "planned",
    "note": "Предварительное размещение; уточняется по мебели и выбранной арматуре.",
    "planPosition": [
      4.98,
      0.17
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R05",
    "sockets": 2,
    "heightNote": "Верх тумбы + 0,15",
    "mounting": "wall"
  },
  {
    "id": "R06",
    "kind": "socket",
    "room": "bedroom_east",
    "label": "Правая тумба у изголовья",
    "position": [
      3.2,
      0.65,
      -3.06
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q05"
    ],
    "status": "planned",
    "note": "Предварительное размещение; уточняется по мебели и выбранной арматуре.",
    "planPosition": [
      7.2,
      0.17
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R06",
    "sockets": 2,
    "heightNote": "Верх тумбы + 0,15",
    "mounting": "wall"
  },
  {
    "id": "R07",
    "kind": "socket",
    "room": "bedroom_east",
    "label": "Резерв телевизора на стене напротив кровати",
    "position": [
      2.08,
      1.3,
      -0.66018
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "circuits": [
      "Q05"
    ],
    "status": "reserve",
    "note": "Предварительное размещение; уточняется по мебели и выбранной арматуре.",
    "planPosition": [
      6.08,
      2.52
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R07",
    "sockets": 2,
    "heightNote": "По кронштейну; ориентир 1,20-1,40",
    "mounting": "wall"
  },
  {
    "id": "R08",
    "kind": "socket",
    "room": "bedroom_east",
    "label": "Сервисный блок на свободном участке правой стены",
    "position": [
      3.81,
      0.3,
      -0.88
    ],
    "normal": [
      -1,
      0,
      0
    ],
    "circuits": [
      "Q05"
    ],
    "status": "planned",
    "note": "Предварительное размещение; уточняется по мебели и выбранной арматуре.",
    "planPosition": [
      7.81,
      2.37
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R08",
    "sockets": 2,
    "heightNote": "0,30; не за шкафом",
    "mounting": "wall"
  },
  {
    "id": "R09",
    "kind": "socket",
    "room": "living",
    "label": "ТВ-перегородка: три гнезда за ТВ и три в тумбе",
    "position": [
      -1.4075,
      1.2,
      1.11
    ],
    "normal": [
      1,
      0,
      0
    ],
    "circuits": [
      "Q06"
    ],
    "status": "planned",
    "note": "Два блока по три гнезда: за телевизором и в зоне тумбы. Положение уточняется по креплению экрана и доступу к розеткам.",
    "planPosition": [
      2.64,
      4.45
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R09",
    "sockets": 6,
    "heightNote": "По ТВ; нижний блок 0,30",
    "mounting": "wall",
    "mounts": [
      {
        "position": [
          -1.4075,
          1.2,
          1.11
        ],
        "normal": [
          1,
          0,
          0
        ],
        "sockets": 3
      },
      {
        "position": [
          -1.4075,
          0.3,
          1.11
        ],
        "normal": [
          1,
          0,
          0
        ],
        "sockets": 3
      }
    ]
  },
  {
    "id": "R10",
    "kind": "socket",
    "room": "living",
    "label": "Подвод к дивану в полу под мебелью",
    "position": [
      1.08,
      0.015,
      2.43
    ],
    "normal": [
      0,
      1,
      0
    ],
    "circuits": [
      "Q06"
    ],
    "status": "optional",
    "note": "Предварительное размещение; уточняется по мебели и выбранной арматуре.",
    "planPosition": [
      5.08,
      5.68
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R10",
    "sockets": 2,
    "heightNote": "Только после фиксации мебели и узла пола",
    "mounting": "floor"
  },
  {
    "id": "R11",
    "kind": "socket",
    "room": "living",
    "label": "Док робота в открытой нише у нижней части ТВ-перегородки",
    "position": [
      -1.4075,
      0.25,
      1.85
    ],
    "normal": [
      1,
      0,
      0
    ],
    "circuits": [
      "Q06"
    ],
    "status": "planned",
    "note": "Питание дока робота у ТВ-тумбы. Нужно предусмотреть открытую нишу и свободный выезд; нынешняя тумба сплошная.",
    "planPosition": [
      2.64,
      5.01
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R11",
    "sockets": 1,
    "heightNote": "0,20-0,30; оставить место выезда",
    "mounting": "wall"
  },
  {
    "id": "R12",
    "kind": "socket",
    "room": "living",
    "label": "Сервисный блок на правой стене у обеденной зоны",
    "position": [
      3.81,
      0.3,
      2.42
    ],
    "normal": [
      -1,
      0,
      0
    ],
    "circuits": [
      "Q06"
    ],
    "status": "planned",
    "note": "Предварительное размещение; уточняется по мебели и выбранной арматуре.",
    "planPosition": [
      7.81,
      5.67
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R12",
    "sockets": 2,
    "heightNote": "0,30; увязать с окном и отоплением",
    "mounting": "wall"
  },
  {
    "id": "R13",
    "kind": "socket",
    "room": "living",
    "label": "Первый вертикальный блок над рабочей секцией 600 мм; проверить рамку",
    "position": [
      1.98,
      1.141,
      -0.42518
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q07"
    ],
    "status": "planned",
    "note": "Три вертикально расположенных гнезда над рабочей поверхностью. Высоту и рамку нужно увязать со столешницей и верхними шкафами.",
    "planPosition": [
      5.98,
      2.75
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R13",
    "sockets": 3,
    "heightNote": "Нижнее гнездо: столешница + 0,15-0,20",
    "mounting": "vertical-wall-block",
    "mounts": [
      {
        "position": [
          1.98,
          1.07,
          -0.42518
        ],
        "normal": [
          0,
          0,
          1
        ],
        "sockets": 1
      },
      {
        "position": [
          1.98,
          1.141,
          -0.42518
        ],
        "normal": [
          0,
          0,
          1
        ],
        "sockets": 1
      },
      {
        "position": [
          1.98,
          1.212,
          -0.42518
        ],
        "normal": [
          0,
          0,
          1
        ],
        "sockets": 1
      }
    ]
  },
  {
    "id": "R14",
    "kind": "socket",
    "room": "living",
    "label": "Второй вертикальный блок фартука, отдельная питающая группа",
    "position": [
      2.31,
      1.141,
      -0.42518
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q08"
    ],
    "status": "planned",
    "note": "Второй вертикальный блок из трёх гнёзд с отдельным питанием. Размещается рядом с первым блоком и кнопкой рабочего света.",
    "planPosition": [
      6.31,
      2.75
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R14",
    "sockets": 3,
    "heightNote": "Нижнее гнездо: столешница + 0,15-0,20",
    "mounting": "vertical-wall-block",
    "mounts": [
      {
        "position": [
          2.31,
          1.07,
          -0.42518
        ],
        "normal": [
          0,
          0,
          1
        ],
        "sockets": 1
      },
      {
        "position": [
          2.31,
          1.141,
          -0.42518
        ],
        "normal": [
          0,
          0,
          1
        ],
        "sockets": 1
      },
      {
        "position": [
          2.31,
          1.212,
          -0.42518
        ],
        "normal": [
          0,
          0,
          1
        ],
        "sockets": 1
      }
    ]
  },
  {
    "id": "R15",
    "kind": "socket",
    "room": "living",
    "label": "Холодильник: доступ в соседнем отсеке/цоколе по паспорту",
    "position": null,
    "normal": [
      1,
      0,
      0
    ],
    "circuits": [
      "Q09"
    ],
    "status": "coordination",
    "note": "Для холодильника нужно выбрать розетку с доступом для обслуживания. До этого место установки не назначено.",
    "planPosition": [
      7.52,
      2.77
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R15",
    "sockets": 1,
    "heightNote": "По кухонному проекту",
    "mounting": "wall"
  },
  {
    "id": "R16",
    "kind": "socket",
    "room": "living",
    "label": "Вытяжка в верхнем шкафу, с доступом",
    "position": [
      2.8,
      2.03,
      -0.42518
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q18"
    ],
    "status": "planned",
    "note": "Предварительное размещение; уточняется по мебели и выбранной арматуре.",
    "planPosition": [
      6.8,
      3.21
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R16",
    "sockets": 1,
    "heightNote": "По вытяжке и шкафам",
    "mounting": "wall"
  },
  {
    "id": "R17",
    "kind": "socket",
    "room": "living",
    "label": "Посудомойка под рабочей секцией, если ее выбирают",
    "position": null,
    "normal": [
      1,
      0,
      0
    ],
    "circuits": [
      "Q12"
    ],
    "status": "optional",
    "note": "Посудомоечная машина пока не выбрана. Розетку нужно разместить в сухом доступном соседнем отсеке; место ещё не назначено.",
    "planPosition": [
      5.7,
      3.24
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R17",
    "sockets": 1,
    "heightNote": "В соседнем сухом доступном отсеке",
    "mounting": "wall"
  },
  {
    "id": "R18",
    "kind": "socket",
    "room": "living",
    "label": "Духовой шкаф под панелью, если входит в кухню",
    "position": null,
    "normal": [
      1,
      0,
      0
    ],
    "circuits": [
      "Q11"
    ],
    "status": "optional",
    "note": "Духовой шкаф пока не выбран. Место доступного подключения уточняется вместе с кухонной мебелью.",
    "planPosition": [
      6.8,
      3.49
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R18",
    "sockets": 1,
    "heightNote": "В соседнем сухом доступном отсеке",
    "mounting": "wall"
  },
  {
    "id": "R19",
    "kind": "socket",
    "room": "bathroom",
    "label": "Стиральная машина: точку согласовать по зонам душа",
    "position": null,
    "normal": [
      1,
      0,
      0
    ],
    "circuits": [
      "Q13"
    ],
    "status": "coordination",
    "note": "Место розетки стиральной машины определяется после проверки зон душевой. Пока точка установки не назначена.",
    "planPosition": null,
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R19",
    "sockets": 1,
    "heightNote": "Вне зон 0-2; по отдельному узлу",
    "mounting": "wall"
  },
  {
    "id": "R20",
    "kind": "socket",
    "room": "bathroom",
    "label": "Фен / щетка: только если имеется допустимая зона",
    "position": null,
    "normal": [
      1,
      0,
      0
    ],
    "circuits": [
      "Q14"
    ],
    "status": "coordination",
    "note": "Розетки у зеркала возможны после проверки допустимой зоны. Пока точка установки не назначена.",
    "planPosition": null,
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R20",
    "sockets": 2,
    "heightNote": "Ориентир 1,10-1,20, после проверки зоны",
    "mounting": "wall"
  },
  {
    "id": "R21",
    "kind": "socket",
    "room": "entry",
    "label": "Сервисный блок на правом от наружного входа простенке, под S01",
    "position": [
      -1.85,
      0.3,
      3.06
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "circuits": [
      "Q21"
    ],
    "status": "planned",
    "note": "Предварительное размещение; уточняется по мебели и выбранной арматуре.",
    "planPosition": [
      2.15,
      6.26
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R21",
    "sockets": 2,
    "heightNote": "0,30",
    "mounting": "wall"
  },
  {
    "id": "R22",
    "kind": "socket",
    "room": "entry",
    "label": "Зарядка вертикального пылесоса в оставшейся части шкафа",
    "position": [
      -3.81018,
      1.1,
      2.87
    ],
    "normal": [
      1,
      0,
      0
    ],
    "circuits": [
      "Q21"
    ],
    "status": "planned",
    "note": "Точка внутри оставшейся секции существующего шкафа; высота держателя пылесоса требует выбора модели.",
    "planPosition": [
      0.19,
      6.12
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R22",
    "sockets": 1,
    "heightNote": "По держателю, с вентиляцией",
    "mounting": "inside-cabinet"
  },
  {
    "id": "R23",
    "kind": "socket",
    "room": "entry",
    "label": "Левая сторона у входа, защищенное исполнение",
    "position": [
      -4.047,
      0.75,
      3.85
    ],
    "normal": [
      1,
      0,
      0
    ],
    "circuits": [
      "Q22"
    ],
    "status": "planned",
    "note": "Предварительное размещение; уточняется по мебели и выбранной арматуре.",
    "planPosition": [
      0.18,
      7.1
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R23",
    "sockets": 2,
    "heightNote": "0,60-0,90; по снегу и уборке",
    "mounting": "wall"
  },
  {
    "id": "R24",
    "kind": "socket",
    "room": "entry",
    "label": "Правая сторона у места отдыха",
    "position": [
      4.047,
      0.75,
      3.85
    ],
    "normal": [
      -1,
      0,
      0
    ],
    "circuits": [
      "Q22"
    ],
    "status": "planned",
    "note": "Предварительное размещение; уточняется по мебели и выбранной арматуре.",
    "planPosition": [
      7.8,
      7.1
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R24",
    "sockets": 2,
    "heightNote": "0,60-0,90; по снегу и уборке",
    "mounting": "wall"
  },
  {
    "id": "R25",
    "kind": "socket",
    "room": "entry",
    "label": "Сервисная наружная точка на противоположном фасаде",
    "position": [
      -3.78,
      0.75,
      -3.328
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "circuits": [
      "Q22"
    ],
    "status": "planned",
    "note": "Предварительное размещение; уточняется по мебели и выбранной арматуре.",
    "planPosition": [
      0.22,
      -0.13
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R25",
    "sockets": 1,
    "heightNote": "По рельефу, снегу и исполнению",
    "mounting": "wall"
  },
  {
    "id": "R26",
    "kind": "socket",
    "room": "entry",
    "label": "Служебный блок сети/ИБП; отдельно от бытовых розеток",
    "position": null,
    "normal": [
      1,
      0,
      0
    ],
    "circuits": [
      "Q25"
    ],
    "status": "coordination",
    "note": "Шесть служебных гнёзд для сети и ИБП внутри технического отсека. Раскладка уточняется после выбора оборудования.",
    "planPosition": null,
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/R26",
    "sockets": 6,
    "heightNote": "В доступном слаботочном отсеке",
    "mounting": "inside-panel"
  },
  {
    "id": "P01",
    "kind": "load",
    "room": "living",
    "label": "Варочная панель",
    "position": [
      2.7,
      0.65,
      -0.3
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q10"
    ],
    "status": "planned",
    "note": "Отдельный вывод в тумбе под варочной панелью. Доступ, способ подключения и мощность уточняются после выбора панели.",
    "planPosition": [
      6.7,
      2.95
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/P01",
    "mounting": "inside-cabinet",
    "sourceGuids": [
      "125DSbzmT1d9GBbrneD_uK"
    ]
  },
  {
    "id": "P02",
    "kind": "load",
    "room": "bathroom",
    "label": "Котел",
    "position": null,
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q15"
    ],
    "status": "coordination",
    "note": "Тип и мощность неизвестны. Отдельные трассы питания и разрешенного управления.",
    "planPosition": null,
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/P02"
  },
  {
    "id": "P03",
    "kind": "load",
    "room": "bathroom",
    "label": "Бак 100 л",
    "position": null,
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q16"
    ],
    "status": "coordination",
    "note": "Силовая линия нужна, если есть электрический нагреватель. Не считать надпись доказательством наличия ТЭНа.",
    "planPosition": null,
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/P03"
  },
  {
    "id": "P04",
    "kind": "load",
    "room": "bathroom",
    "label": "Теплый пол санузла",
    "position": null,
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q17"
    ],
    "status": "optional",
    "note": "Опция. Для электрического пола нужны термостат и сменяемая трубка датчика пола.",
    "planPosition": null,
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/P04"
  },
  {
    "id": "P05",
    "kind": "load",
    "room": "entry",
    "label": "Вентиляция",
    "position": null,
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q18"
    ],
    "status": "coordination",
    "note": "Тип установки и схема воздуховодов отдельно. Вытяжка кухни не заменяет воздухообмен дома.",
    "planPosition": null,
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/P05"
  },
  {
    "id": "P06",
    "kind": "load",
    "room": "living",
    "label": "Кондиционер гостиной",
    "position": [
      0.81,
      2.3,
      -0.42518
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q19"
    ],
    "status": "reserve",
    "note": "Резерв. Питание внутреннего/наружного блока определяется паспортом; увязать дренаж. Показан только резерв у стены; модель блока и монтажная позиция не подтверждены.",
    "planPosition": [
      4.81,
      2.78
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/P06"
  },
  {
    "id": "P07",
    "kind": "load",
    "room": "bedroom_east",
    "label": "Кондиционер спальни",
    "position": null,
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q20"
    ],
    "status": "reserve",
    "note": "Резерв трассы. Для маленькой спальни необходимость и мощность сначала проверить.",
    "planPosition": null,
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/P07"
  },
  {
    "id": "L01",
    "kind": "light",
    "room": "bedroom_west",
    "label": "Кабинет: общий свет",
    "position": [
      -1.95,
      2.347,
      -2.07
    ],
    "normal": [
      0,
      -1,
      0
    ],
    "circuits": [
      "Q01"
    ],
    "status": "planned",
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости.",
    "planPosition": [
      2.05,
      1.18
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/L01",
    "lightGroup": "L01",
    "mounting": "ceiling"
  },
  {
    "id": "L02",
    "kind": "light",
    "room": "bedroom_west",
    "label": "Кабинет: свет у дивана",
    "position": [
      -2.55,
      1.65,
      -0.66018
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "circuits": [
      "Q01"
    ],
    "status": "planned",
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости.",
    "planPosition": [
      1.45,
      2.29
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/L02",
    "lightGroup": "L02",
    "mounting": "wall"
  },
  {
    "id": "L03",
    "kind": "light",
    "room": "bedroom_east",
    "label": "Спальня: общий свет",
    "position": [
      2.02,
      2.347,
      -1.73
    ],
    "normal": [
      0,
      -1,
      0
    ],
    "circuits": [
      "Q02"
    ],
    "status": "planned",
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости.",
    "planPosition": [
      6.02,
      1.52
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/L03",
    "lightGroup": "L03",
    "mounting": "ceiling"
  },
  {
    "id": "L04",
    "kind": "light",
    "room": "bedroom_east",
    "label": "Спальня: левое бра",
    "position": [
      0.93,
      1.12,
      -3.06
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q02"
    ],
    "status": "planned",
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости.",
    "planPosition": [
      4.93,
      0.39
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/L04",
    "lightGroup": "L04",
    "mounting": "wall"
  },
  {
    "id": "L05",
    "kind": "light",
    "room": "bedroom_east",
    "label": "Спальня: правое бра",
    "position": [
      3.2,
      1.12,
      -3.06
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q02"
    ],
    "status": "planned",
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости.",
    "planPosition": [
      7.2,
      0.39
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/L05",
    "lightGroup": "L05",
    "mounting": "wall"
  },
  {
    "id": "L06",
    "kind": "light",
    "room": "living",
    "label": "Гостиная: общий свет",
    "position": [
      -0.06,
      3.385,
      1.31
    ],
    "normal": [
      0,
      -1,
      0
    ],
    "circuits": [
      "Q01"
    ],
    "status": "planned",
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости.",
    "planPosition": [
      3.94,
      4.56
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/L06",
    "lightGroup": "L06",
    "mounting": "ceiling"
  },
  {
    "id": "L07",
    "kind": "light",
    "room": "living",
    "label": "Подвес над столом",
    "position": [
      1.83783,
      2.2,
      1.51273
    ],
    "normal": [
      0,
      -1,
      0
    ],
    "circuits": [
      "Q01"
    ],
    "status": "planned",
    "note": "Сохранённый подвес над белым обеденным столом.",
    "planPosition": [
      6.36,
      4.63
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/L07",
    "lightGroup": "L07",
    "mounting": "existing-fixture"
  },
  {
    "id": "L08",
    "kind": "light",
    "room": "living",
    "label": "Рабочая подсветка кухни",
    "position": [
      2.16,
      1.486,
      -0.03727
    ],
    "normal": [
      0,
      -1,
      0
    ],
    "circuits": [
      "Q01"
    ],
    "status": "planned",
    "note": "Обе линии подсветки под верхними кухонными шкафами включаются вместе.",
    "planPosition": [
      6.24,
      3.39
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/L08",
    "lightGroup": "L08",
    "mounting": "existing-fixture"
  },
  {
    "id": "L09",
    "kind": "light",
    "room": "entry",
    "label": "Прихожая: общий свет",
    "position": [
      -2.47,
      2.347,
      2.41
    ],
    "normal": [
      0,
      -1,
      0
    ],
    "circuits": [
      "Q02"
    ],
    "status": "planned",
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости.",
    "planPosition": [
      1.53,
      5.66
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/L09",
    "lightGroup": "L09",
    "mounting": "ceiling"
  },
  {
    "id": "L10",
    "kind": "light",
    "room": "bathroom",
    "label": "Санузел: общий свет; исполнение по зоне",
    "position": [
      -2.6,
      2.347,
      0.36
    ],
    "normal": [
      0,
      -1,
      0
    ],
    "circuits": [
      "Q02"
    ],
    "status": "planned",
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости.",
    "planPosition": [
      1.4,
      3.61
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/L10",
    "lightGroup": "L10",
    "mounting": "ceiling"
  },
  {
    "id": "L11",
    "kind": "light",
    "room": "bathroom",
    "label": "Санузел: зеркало; исполнение по зоне",
    "position": [
      -2.83751,
      1.64,
      1.527
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "circuits": [
      "Q01"
    ],
    "status": "planned",
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости.",
    "planPosition": [
      1.2,
      4.75
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/L11",
    "lightGroup": "L11",
    "mounting": "wall"
  },
  {
    "id": "L12",
    "kind": "light",
    "room": "entry",
    "label": "Терраса: основной свет",
    "position": [
      0.06,
      3.27,
      4.54
    ],
    "normal": [
      0,
      -1,
      0
    ],
    "circuits": [
      "Q03"
    ],
    "status": "planned",
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости.",
    "planPosition": [
      4.06,
      7.79
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/L12",
    "lightGroup": "L12",
    "mounting": "ceiling"
  },
  {
    "id": "L13",
    "kind": "light",
    "room": "entry",
    "label": "Вход / фасад: отдельная группа",
    "position": [
      1.48783,
      1.85,
      3.44273
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q03"
    ],
    "status": "planned",
    "note": "Сохранённый наружный светильник у фасада террасы.",
    "planPosition": [
      1.51,
      6.82
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/L13",
    "lightGroup": "L13",
    "mounting": "existing-fixture"
  },
  {
    "id": "L14",
    "kind": "light",
    "room": "living",
    "label": "Ночной маршрут в прихожей и гостиной",
    "position": [
      -1.02,
      0.15,
      2.09
    ],
    "normal": [
      0,
      1,
      0
    ],
    "circuits": [
      "Q02"
    ],
    "status": "planned",
    "note": "Низкий ночной маршрут 150 мм; условная метка группы, независимые аккумуляторные светильники E01/E02 описаны отдельно.",
    "planPosition": [
      2.98,
      5.34
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/L14",
    "lightGroup": "L14",
    "mounting": "low-route"
  },
  {
    "id": "S01",
    "kind": "switch",
    "room": "entry",
    "label": "В тамбуре у ручки входной двери",
    "position": [
      -1.85,
      0.9,
      3.06
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "circuits": [
      "Q02",
      "Q03"
    ],
    "status": "planned",
    "note": "Прихожая; терраса; «Ушел». Долго на клавише прихожей - ночной маршрут. L09, L12, L14 локально; «Ушел» через WB. Слаботочная физическая кнопка; прямые входы соответствующих модулей света.",
    "planPosition": [
      2.15,
      6.24
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/S01",
    "controls": [
      "L09",
      "L14",
      "L12"
    ],
    "keys": [
      {
        "key": 1,
        "label": "Прихожая",
        "targets": [
          "L09"
        ],
        "action": "toggle",
        "requiresWB": false,
        "longPress": {
          "label": "Ночной маршрут",
          "targets": [
            "L14"
          ]
        }
      },
      {
        "key": 2,
        "label": "Терраса",
        "targets": [
          "L12"
        ],
        "action": "toggle",
        "requiresWB": false
      },
      {
        "key": 3,
        "label": "Ушёл",
        "targets": [],
        "action": "away",
        "requiresWB": true
      }
    ],
    "mounting": "wall"
  },
  {
    "id": "S02",
    "kind": "switch",
    "room": "living",
    "label": "Со стороны гостиной у двери тамбура",
    "position": [
      -1.4075,
      0.9,
      1.85
    ],
    "normal": [
      1,
      0,
      0
    ],
    "circuits": [
      "Q01"
    ],
    "status": "planned",
    "note": "Общий свет; стол; рабочая подсветка кухни. L06, L07, L08 локально. Слаботочная физическая кнопка; прямые входы соответствующих модулей света.",
    "planPosition": [
      2.69,
      5.12
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/S02",
    "controls": [
      "L06",
      "L07",
      "L08"
    ],
    "keys": [
      {
        "key": 1,
        "label": "Общий свет",
        "targets": [
          "L06"
        ],
        "action": "toggle",
        "requiresWB": false
      },
      {
        "key": 2,
        "label": "Над столом",
        "targets": [
          "L07"
        ],
        "action": "toggle",
        "requiresWB": false
      },
      {
        "key": 3,
        "label": "Рабочая кухня",
        "targets": [
          "L08"
        ],
        "action": "toggle",
        "requiresWB": false
      }
    ],
    "mounting": "wall"
  },
  {
    "id": "S03",
    "kind": "switch",
    "room": "bedroom_west",
    "label": "В кабинете у ручки двери, на возврате центральной перегородки",
    "position": [
      -0.11774,
      0.9,
      -1.0
    ],
    "normal": [
      -1,
      0,
      0
    ],
    "circuits": [
      "Q01"
    ],
    "status": "planned",
    "note": "Общий свет; свет у дивана. L01, L02 локально. Слаботочная физическая кнопка; прямые входы соответствующих модулей света. Кнопка расположена на простенке рядом с дверью.",
    "planPosition": [
      3.75,
      2.25
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/S03",
    "controls": [
      "L01",
      "L02"
    ],
    "keys": [
      {
        "key": 1,
        "label": "Общий свет кабинета",
        "targets": [
          "L01"
        ],
        "action": "toggle",
        "requiresWB": false
      },
      {
        "key": 2,
        "label": "Свет у дивана",
        "targets": [
          "L02"
        ],
        "action": "toggle",
        "requiresWB": false
      }
    ],
    "mounting": "wall"
  },
  {
    "id": "S04",
    "kind": "switch",
    "room": "bedroom_west",
    "label": "У подлокотника дивана кабинета",
    "position": [
      -3.6,
      0.9,
      -0.66018
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "circuits": [
      "Q01"
    ],
    "status": "planned",
    "note": "Повтор общего и местного света. Те же входы L01, L02. Слаботочная физическая кнопка; прямые входы соответствующих модулей света.",
    "planPosition": [
      0.46,
      2.34
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/S04",
    "controls": [
      "L01",
      "L02"
    ],
    "keys": [
      {
        "key": 1,
        "label": "Общий свет кабинета",
        "targets": [
          "L01"
        ],
        "action": "toggle",
        "requiresWB": false
      },
      {
        "key": 2,
        "label": "Свет у дивана",
        "targets": [
          "L02"
        ],
        "action": "toggle",
        "requiresWB": false
      }
    ],
    "mounting": "wall"
  },
  {
    "id": "S05",
    "kind": "switch",
    "room": "bedroom_east",
    "label": "В спальне у ручки двери",
    "position": [
      1.31,
      0.9,
      -0.66018
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "circuits": [
      "Q02"
    ],
    "status": "planned",
    "note": "Общий свет; шторы / сценарий спальни. L03 локально; вторая функция после выбора привода. Слаботочная физическая кнопка; прямые входы соответствующих модулей света. Кнопка расположена на простенке рядом с дверью.",
    "planPosition": [
      5.2,
      2.42
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/S05",
    "controls": [
      "L03"
    ],
    "keys": [
      {
        "key": 1,
        "label": "Общий свет спальни",
        "targets": [
          "L03"
        ],
        "action": "toggle",
        "requiresWB": false
      },
      {
        "key": 2,
        "label": "Шторы / сценарий: резерв",
        "targets": [],
        "action": "reserve",
        "requiresWB": false
      }
    ],
    "mounting": "wall"
  },
  {
    "id": "S06",
    "kind": "switch",
    "room": "bedroom_east",
    "label": "Над левой прикроватной тумбой",
    "position": [
      1.12,
      0.76,
      -3.06
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q02"
    ],
    "status": "planned",
    "note": "Общий свет; свое бра; опционально «Спать». L03, L04 локально; сцена через WB. Слаботочная физическая кнопка; прямые входы соответствующих модулей света. Третья клавиша «Спать» выбрана для демо из опциональной функции ТЗ; зависит от WB.",
    "planPosition": [
      5.12,
      0.63
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/S06",
    "controls": [
      "L03",
      "L04"
    ],
    "keys": [
      {
        "key": 1,
        "label": "Общий свет спальни",
        "targets": [
          "L03"
        ],
        "action": "toggle",
        "requiresWB": false
      },
      {
        "key": 2,
        "label": "Левое бра",
        "targets": [
          "L04"
        ],
        "action": "toggle",
        "requiresWB": false
      },
      {
        "key": 3,
        "label": "Спать: предлагаемая опция",
        "targets": [],
        "action": "night",
        "requiresWB": true
      }
    ],
    "mounting": "wall"
  },
  {
    "id": "S07",
    "kind": "switch",
    "room": "bedroom_east",
    "label": "Над правой прикроватной тумбой",
    "position": [
      3.42,
      0.76,
      -3.06
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q02"
    ],
    "status": "planned",
    "note": "Общий свет; свое бра; опционально шторы. L03, L05 локально; привод по выбранной схеме. Слаботочная физическая кнопка; прямые входы соответствующих модулей света.",
    "planPosition": [
      7.42,
      0.63
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/S07",
    "controls": [
      "L03",
      "L05"
    ],
    "keys": [
      {
        "key": 1,
        "label": "Общий свет спальни",
        "targets": [
          "L03"
        ],
        "action": "toggle",
        "requiresWB": false
      },
      {
        "key": 2,
        "label": "Правое бра",
        "targets": [
          "L05"
        ],
        "action": "toggle",
        "requiresWB": false
      },
      {
        "key": 3,
        "label": "Шторы: резерв",
        "targets": [],
        "action": "reserve",
        "requiresWB": false
      }
    ],
    "mounting": "wall"
  },
  {
    "id": "S08",
    "kind": "switch",
    "room": "living",
    "label": "Снаружи санузла ниже проема, у ручки двери",
    "position": [
      -1.4075,
      0.9,
      0.78
    ],
    "normal": [
      1,
      0,
      0
    ],
    "circuits": [
      "Q01",
      "Q02"
    ],
    "status": "planned",
    "note": "Общий свет; зеркало; опционально усиление вытяжки. L10, L11 локально; вентиляция штатным входом. Слаботочная физическая кнопка; прямые входы соответствующих модулей света. Кнопка расположена на простенке рядом с дверью.",
    "planPosition": [
      2.72,
      3.95
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/S08",
    "controls": [
      "L10",
      "L11"
    ],
    "keys": [
      {
        "key": 1,
        "label": "Общий свет санузла",
        "targets": [
          "L10"
        ],
        "action": "toggle",
        "requiresWB": false
      },
      {
        "key": 2,
        "label": "Зеркало",
        "targets": [
          "L11"
        ],
        "action": "toggle",
        "requiresWB": false
      },
      {
        "key": 3,
        "label": "Усиление вентиляции: резерв",
        "targets": [],
        "action": "reserve",
        "requiresWB": false
      }
    ],
    "mounting": "wall"
  },
  {
    "id": "S09",
    "kind": "switch",
    "room": "living",
    "label": "На фартуке / боковине шкафов у рабочей секции; увязать рамки",
    "position": [
      2.14,
      1.14,
      -0.42518
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q01"
    ],
    "status": "planned",
    "note": "Повтор рабочего света. L08 локально. Слаботочная физическая кнопка; прямые входы соответствующих модулей света.",
    "planPosition": [
      6.14,
      2.75
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/S09",
    "controls": [
      "L08"
    ],
    "keys": [
      {
        "key": 1,
        "label": "Рабочая кухня",
        "targets": [
          "L08"
        ],
        "action": "toggle",
        "requiresWB": false
      }
    ],
    "mounting": "wall"
  },
  {
    "id": "S10",
    "kind": "switch",
    "room": "living",
    "label": "Внутри у выхода гостиной на террасу",
    "position": [
      1.52,
      0.9,
      3.06
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "circuits": [
      "Q03"
    ],
    "status": "planned",
    "note": "Терраса; фасад. L12, L13 локально. Слаботочная физическая кнопка; прямые входы соответствующих модулей света.",
    "planPosition": [
      5.49,
      6.23
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/S10",
    "controls": [
      "L12",
      "L13"
    ],
    "keys": [
      {
        "key": 1,
        "label": "Терраса",
        "targets": [
          "L12"
        ],
        "action": "toggle",
        "requiresWB": false
      },
      {
        "key": 2,
        "label": "Фасад",
        "targets": [
          "L13"
        ],
        "action": "toggle",
        "requiresWB": false
      }
    ],
    "mounting": "wall"
  },
  {
    "id": "T1",
    "kind": "panel",
    "room": "entry",
    "label": "Т1 · силовой и сетевой отсеки",
    "position": [
      -3.28018,
      1.2,
      2.39
    ],
    "normal": [
      1,
      0,
      0
    ],
    "circuits": [
      "Q24",
      "Q25"
    ],
    "status": "coordination",
    "note": "Предлагаемая отдельная секция существующего шкафа прихожей; электрический и сетевой отсеки разделены. Размеры, вентиляция и размещение оборудования не подтверждены.",
    "planPosition": [
      0.46,
      5.72
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/T1",
    "mounting": "cabinet-proposal",
    "sourceGuids": [
      "1LnyKsoqTBSeF$gJk5C3MY"
    ]
  },
  {
    "id": "N01",
    "kind": "ethernet",
    "room": "bedroom_west",
    "label": "Рабочий стол кабинета",
    "position": [
      -2.56,
      0.38,
      -3.06
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q25"
    ],
    "status": "planned",
    "note": "Компьютер, док, рабочее оборудование, резерв Каждый порт — отдельный непрерывный кабель до патч-панели Т1.",
    "planPosition": [
      1.44,
      0.22
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/N01",
    "ports": 4,
    "mounting": "wall"
  },
  {
    "id": "N02",
    "kind": "ethernet",
    "room": "living",
    "label": "Телевизор гостиной",
    "position": [
      -1.4075,
      1.2,
      1.58
    ],
    "normal": [
      1,
      0,
      0
    ],
    "circuits": [
      "Q25"
    ],
    "status": "planned",
    "note": "ТВ, приставка, консоль, резерв; два сверху и два у тумбы Каждый порт — отдельный непрерывный кабель до патч-панели Т1.",
    "planPosition": [
      2.64,
      4.54
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/N02",
    "ports": 4,
    "mounting": "wall",
    "mounts": [
      {
        "position": [
          -1.4075,
          1.2,
          1.58
        ],
        "normal": [
          1,
          0,
          0
        ],
        "ports": 2
      },
      {
        "position": [
          -1.4075,
          0.3,
          1.58
        ],
        "normal": [
          1,
          0,
          0
        ],
        "ports": 2
      }
    ]
  },
  {
    "id": "N03",
    "kind": "ethernet",
    "room": "bedroom_east",
    "label": "Резерв ТВ спальни",
    "position": [
      2.34,
      1.3,
      -0.66018
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "circuits": [
      "Q25"
    ],
    "status": "reserve",
    "note": "За будущим ТВ, совместно по высоте с R07 Каждый порт — отдельный непрерывный кабель до патч-панели Т1.",
    "planPosition": [
      6.05,
      2.5
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/N03",
    "ports": 2,
    "mounting": "wall"
  },
  {
    "id": "N04",
    "kind": "ethernet",
    "room": "living",
    "label": "Потолочная точка доступа",
    "position": [
      0.14,
      3.365,
      0.39
    ],
    "normal": [
      0,
      -1,
      0
    ],
    "circuits": [
      "Q25"
    ],
    "status": "planned",
    "note": "PoE, потолок центральной части гостиной Каждый порт — отдельный непрерывный кабель до патч-панели Т1.",
    "planPosition": [
      4.14,
      3.64
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/N04",
    "ports": 1,
    "mounting": "ceiling"
  },
  {
    "id": "N05",
    "kind": "ethernet",
    "room": "entry",
    "label": "Камера входа / террасы",
    "position": [
      -3.47,
      2.18,
      3.33
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q25"
    ],
    "status": "planned",
    "note": "PoE, под свесом; проверить распознавание лица днем и ночью Каждый порт — отдельный непрерывный кабель до патч-панели Т1.",
    "planPosition": [
      0.53,
      6.64
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/N05",
    "ports": 1,
    "mounting": "wall"
  },
  {
    "id": "N06",
    "kind": "ethernet",
    "room": "entry",
    "label": "Камера противоположного фасада",
    "position": [
      3.68,
      2.18,
      -3.353
    ],
    "normal": [
      0.707107,
      0,
      -0.707107
    ],
    "circuits": [
      "Q25"
    ],
    "status": "planned",
    "note": "PoE, угол и высота после осмотра участка Каждый порт — отдельный непрерывный кабель до патч-панели Т1.",
    "planPosition": [
      7.68,
      -0.1
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/N06",
    "ports": 1,
    "mounting": "wall"
  },
  {
    "id": "N07",
    "kind": "ethernet",
    "room": "entry",
    "label": "Вызывная панель у входа",
    "position": [
      -1.89,
      1.35,
      3.33
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q25"
    ],
    "status": "planned",
    "note": "PoE только при совместимой панели; отдельно кабель замка по паспорту Каждый порт — отдельный непрерывный кабель до патч-панели Т1.",
    "planPosition": [
      2.11,
      6.64
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/N07",
    "ports": 1,
    "mounting": "wall"
  },
  {
    "id": "N08",
    "kind": "ethernet",
    "room": "entry",
    "label": "Резерв второго AP / точки террасы",
    "position": [
      3.57,
      2.1,
      3.33
    ],
    "normal": [
      0,
      -1,
      0
    ],
    "circuits": [
      "Q25"
    ],
    "status": "reserve",
    "note": "Кабель заложить; устройство только по результату измерения покрытия Каждый порт — отдельный непрерывный кабель до патч-панели Т1.",
    "planPosition": [
      7.57,
      6.58
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/N08",
    "ports": 1,
    "mounting": "ceiling"
  },
  {
    "id": "M01",
    "kind": "curtain",
    "room": "bedroom_west",
    "label": "Окно кабинета 1400",
    "position": [
      -3.542,
      2.26,
      -1.747
    ],
    "normal": [
      1,
      0,
      0
    ],
    "circuits": [
      "Q23"
    ],
    "status": "reserve",
    "note": "Резерв кабеля к карнизу. Тип мотора и электрическая схема ещё не выбраны.",
    "planPosition": [
      0.17,
      1.54
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/M01",
    "mounting": "cornice-reserve",
    "sourceGuids": [
      "3C1Yl09FP1U8mcKdtFO4gl"
    ]
  },
  {
    "id": "M02",
    "kind": "curtain",
    "room": "bedroom_east",
    "label": "Окно спальни 1400",
    "position": [
      3.548,
      2.26,
      -1.747
    ],
    "normal": [
      -1,
      0,
      0
    ],
    "circuits": [
      "Q23"
    ],
    "status": "reserve",
    "note": "Резерв кабеля к карнизу. Тип мотора и электрическая схема ещё не выбраны.",
    "planPosition": [
      7.82,
      1.54
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/M02",
    "mounting": "cornice-reserve",
    "sourceGuids": [
      "3hikcRWh92FRxXp1pYl2RM"
    ]
  },
  {
    "id": "M03",
    "kind": "curtain",
    "room": "living",
    "label": "Боковое окно гостиной 1400",
    "position": [
      3.548,
      2.26,
      1.453
    ],
    "normal": [
      -1,
      0,
      0
    ],
    "circuits": [
      "Q23"
    ],
    "status": "reserve",
    "note": "Резерв кабеля к карнизу. Тип мотора и электрическая схема ещё не выбраны.",
    "planPosition": [
      7.82,
      4.64
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/M03",
    "mounting": "cornice-reserve",
    "sourceGuids": [
      "3LW4j9F4L69fEmTEJ$NU7j"
    ]
  },
  {
    "id": "M04",
    "kind": "curtain",
    "room": "living",
    "label": "Фасадный проем 2700 с дверью",
    "position": [
      -1.2,
      3.08,
      3.0
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "circuits": [
      "Q23"
    ],
    "status": "reserve",
    "note": "Исходное ТЗ резервировало мотор; последним решением пользователя панорама выполнена тканевыми шторами с фиксированным наклонным верхом и ручными подхватами. Резерв M04/M05 не означает наличие электропривода и не управляет полотнами.",
    "planPosition": [
      4.68,
      6.28
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/M04",
    "mounting": "cornice-reserve",
    "sourceGuids": [
      "3mOQE0kq1ADAzxhHE4vXrq"
    ]
  },
  {
    "id": "M05",
    "kind": "curtain",
    "room": "living",
    "label": "Фасадное остекление 1800",
    "position": [
      3.55,
      2.38,
      3.0
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "circuits": [
      "Q23"
    ],
    "status": "reserve",
    "note": "Исходное ТЗ резервировало мотор; последним решением пользователя панорама выполнена тканевыми шторами с фиксированным наклонным верхом и ручными подхватами. Резерв M04/M05 не означает наличие электропривода и не управляет полотнами.",
    "planPosition": [
      6.84,
      6.28
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/M05",
    "mounting": "cornice-reserve",
    "sourceGuids": [
      "1YQoK7NXH6e984YHSYZLUz"
    ]
  },
  {
    "id": "T01",
    "kind": "sensor",
    "room": "bedroom_west",
    "label": "Температура / CO2 кабинета",
    "position": [
      -0.11774,
      1.35,
      -1.32
    ],
    "normal": [
      -1,
      0,
      0
    ],
    "circuits": [
      "Q24"
    ],
    "status": "planned",
    "note": "Внутренняя стена; 1,2-1,5 м. Позиция — визуальное предложение; область обзора/физическая установка требуют проверки.",
    "planPosition": [
      3.77,
      1.93
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/T01",
    "heightNote": "Внутренняя стена; 1,2-1,5 м",
    "mounting": "wall"
  },
  {
    "id": "T02",
    "kind": "sensor",
    "room": "bedroom_east",
    "label": "Температура / CO2 спальни",
    "position": [
      0.11726,
      1.35,
      -1.34
    ],
    "normal": [
      1,
      0,
      0
    ],
    "circuits": [
      "Q24"
    ],
    "status": "planned",
    "note": "Внутренняя стена; 1,2-1,5 м. Позиция — визуальное предложение; область обзора/физическая установка требуют проверки.",
    "planPosition": [
      4.18,
      1.91
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/T02",
    "heightNote": "Внутренняя стена; 1,2-1,5 м",
    "mounting": "wall"
  },
  {
    "id": "T03",
    "kind": "sensor",
    "room": "living",
    "label": "Температура / CO2 гостиной",
    "position": [
      -0.1,
      1.35,
      -0.42518
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q24"
    ],
    "status": "planned",
    "note": "Внутренняя стена, вне струи кондиционера. Позиция — визуальное предложение; область обзора/физическая установка требуют проверки.",
    "planPosition": [
      3.9,
      2.83
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/T03",
    "heightNote": "Внутренняя стена, вне струи кондиционера",
    "mounting": "wall"
  },
  {
    "id": "H01",
    "kind": "sensor",
    "room": "bathroom",
    "label": "Влажность санузла",
    "position": [
      -3.01,
      1.42,
      -0.42518
    ],
    "normal": [
      0,
      0,
      1
    ],
    "circuits": [
      "Q24"
    ],
    "status": "planned",
    "note": "Вне прямого пара / воды, по датчику. Позиция — визуальное предложение; область обзора/физическая установка требуют проверки. Датчик расположен на внутренней стене вдали от прямых брызг.",
    "planPosition": [
      0.91,
      3.6
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/H01",
    "heightNote": "Вне прямого пара / воды, по датчику",
    "mounting": "wall"
  },
  {
    "id": "O01",
    "kind": "sensor",
    "room": "entry",
    "label": "Присутствие прихожей",
    "position": [
      -2.42,
      2.35,
      2.44
    ],
    "normal": [
      0,
      -1,
      0
    ],
    "circuits": [
      "Q24"
    ],
    "status": "planned",
    "note": "Потолок, обзор входа. Позиция — визуальное предложение; область обзора/физическая установка требуют проверки.",
    "planPosition": [
      1.58,
      5.69
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/O01",
    "heightNote": "Потолок, обзор входа",
    "mounting": "ceiling"
  },
  {
    "id": "O02",
    "kind": "sensor",
    "room": "living",
    "label": "Присутствие гостиной",
    "position": [
      -0.57,
      3.245,
      1.04
    ],
    "normal": [
      0,
      -1,
      0
    ],
    "circuits": [
      "Q24"
    ],
    "status": "planned",
    "note": "Потолок; настроить без срабатывания из спальни. Позиция — визуальное предложение; область обзора/физическая установка требуют проверки.",
    "planPosition": [
      3.43,
      4.29
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/O02",
    "heightNote": "Потолок; настроить без срабатывания из спальни",
    "mounting": "ceiling"
  },
  {
    "id": "W01",
    "kind": "sensor",
    "room": "living",
    "label": "Протечка под кухонной мойкой",
    "position": [
      1.39783,
      0.035,
      0.46273
    ],
    "normal": [
      0,
      1,
      0
    ],
    "circuits": [
      "Q24"
    ],
    "status": "planned",
    "note": "Датчик у доступного края тумбы мойки. При обнаружении воды запускает защитное перекрытие.",
    "planPosition": [
      5.58,
      3.39
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/W01",
    "heightNote": "На полу в месте появления воды",
    "mounting": "floor"
  },
  {
    "id": "W02",
    "kind": "sensor",
    "room": "bathroom",
    "label": "Протечка у стиралки / бака",
    "position": [
      -3.32,
      0.025,
      0.97
    ],
    "normal": [
      0,
      1,
      0
    ],
    "circuits": [
      "Q24"
    ],
    "status": "planned",
    "note": "На полу; датчик доступен. Позиция — визуальное предложение; область обзора/физическая установка требуют проверки. Датчик расположен на доступном полу перед стиральной машиной.",
    "planPosition": [
      0.68,
      4.97
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/W02",
    "heightNote": "На полу; датчик доступен",
    "mounting": "floor"
  },
  {
    "id": "W03",
    "kind": "sensor",
    "room": "bathroom",
    "label": "Протечка у котла / ввода воды",
    "position": [
      -2.6,
      0.025,
      -0.2
    ],
    "normal": [
      0,
      1,
      0
    ],
    "circuits": [
      "Q24"
    ],
    "status": "planned",
    "note": "Уточнить после сантехнической схемы. Позиция — визуальное предложение; область обзора/физическая установка требуют проверки. Показан под существующим котлом; местоположение реального ввода воды неизвестно.",
    "planPosition": [
      1.57,
      3.08
    ],
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/W03",
    "heightNote": "Уточнить после сантехнической схемы",
    "mounting": "floor"
  },
  {
    "id": "E01",
    "kind": "emergency",
    "room": "entry",
    "label": "Автономный аккумуляторный свет у выхода",
    "position": [
      -1.85,
      2.14,
      3.06
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "circuits": [],
    "status": "coordination",
    "note": "Предложение из текстового ТЗ; работает независимо от HA, WB и релейного модуля. Модель, автономность и окончательное место не выбраны.",
    "planPosition": null,
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/E01",
    "mounting": "wall"
  },
  {
    "id": "E02",
    "kind": "emergency",
    "room": "living",
    "label": "Автономный свет на пути к санузлу",
    "position": [
      -1.4075,
      2.14,
      0.78
    ],
    "normal": [
      1,
      0,
      0
    ],
    "circuits": [],
    "status": "coordination",
    "note": "Предложение из текстового ТЗ; работает независимо от HA, WB и релейного модуля. Модель, автономность и окончательное место не выбраны.",
    "planPosition": null,
    "sourceRef": "chat:6acb52a6-8790-832a-89a7-0da9c48150a1/E02",
    "mounting": "wall"
  }
];

export const LIGHT_GROUPS: LightGroup[] = [
  {
    "id": "L01",
    "label": "Кабинет: общий свет",
    "room": "bedroom_west",
    "circuit": "Q01",
    "module": "A",
    "channel": 1,
    "pointId": "L01",
    "controlledBy": [
      "S03",
      "S04"
    ],
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости."
  },
  {
    "id": "L02",
    "label": "Кабинет: свет у дивана",
    "room": "bedroom_west",
    "circuit": "Q01",
    "module": "A",
    "channel": 2,
    "pointId": "L02",
    "controlledBy": [
      "S03",
      "S04"
    ],
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости."
  },
  {
    "id": "L03",
    "label": "Спальня: общий свет",
    "room": "bedroom_east",
    "circuit": "Q02",
    "module": "B",
    "channel": 1,
    "pointId": "L03",
    "controlledBy": [
      "S05",
      "S06",
      "S07"
    ],
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости."
  },
  {
    "id": "L04",
    "label": "Спальня: левое бра",
    "room": "bedroom_east",
    "circuit": "Q02",
    "module": "B",
    "channel": 2,
    "pointId": "L04",
    "controlledBy": [
      "S06"
    ],
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости."
  },
  {
    "id": "L05",
    "label": "Спальня: правое бра",
    "room": "bedroom_east",
    "circuit": "Q02",
    "module": "B",
    "channel": 3,
    "pointId": "L05",
    "controlledBy": [
      "S07"
    ],
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости."
  },
  {
    "id": "L06",
    "label": "Гостиная: общий свет",
    "room": "living",
    "circuit": "Q01",
    "module": "A",
    "channel": 3,
    "pointId": "L06",
    "controlledBy": [
      "S02"
    ],
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости."
  },
  {
    "id": "L07",
    "label": "Подвес над столом",
    "room": "living",
    "circuit": "Q01",
    "module": "A",
    "channel": 4,
    "pointId": "L07",
    "controlledBy": [
      "S02"
    ],
    "note": "Сохранённый подвес над белым обеденным столом."
  },
  {
    "id": "L08",
    "label": "Рабочая подсветка кухни",
    "room": "living",
    "circuit": "Q01",
    "module": "A",
    "channel": 5,
    "pointId": "L08",
    "controlledBy": [
      "S02",
      "S09"
    ],
    "note": "Обе линии подсветки под верхними кухонными шкафами включаются вместе."
  },
  {
    "id": "L09",
    "label": "Прихожая: общий свет",
    "room": "entry",
    "circuit": "Q02",
    "module": "B",
    "channel": 4,
    "pointId": "L09",
    "controlledBy": [
      "S01"
    ],
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости."
  },
  {
    "id": "L10",
    "label": "Санузел: общий свет; исполнение по зоне",
    "room": "bathroom",
    "circuit": "Q02",
    "module": "B",
    "channel": 5,
    "pointId": "L10",
    "controlledBy": [
      "S08"
    ],
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости."
  },
  {
    "id": "L11",
    "label": "Санузел: зеркало; исполнение по зоне",
    "room": "bathroom",
    "circuit": "Q01",
    "module": "A",
    "channel": 6,
    "pointId": "L11",
    "controlledBy": [
      "S08"
    ],
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости."
  },
  {
    "id": "L12",
    "label": "Терраса: основной свет",
    "room": "entry",
    "circuit": "Q03",
    "module": "C",
    "channel": 1,
    "pointId": "L12",
    "controlledBy": [
      "S01",
      "S10"
    ],
    "note": "Показан один светильник группы. Количество и мощность уточняются по требуемой освещённости."
  },
  {
    "id": "L13",
    "label": "Вход / фасад: отдельная группа",
    "room": "entry",
    "circuit": "Q03",
    "module": "C",
    "channel": 2,
    "pointId": "L13",
    "controlledBy": [
      "S10"
    ],
    "note": "Сохранённый наружный светильник у фасада террасы."
  },
  {
    "id": "L14",
    "label": "Ночной маршрут в прихожей и гостиной",
    "room": "living",
    "circuit": "Q02",
    "module": "B",
    "channel": 6,
    "pointId": "L14",
    "controlledBy": [
      "S01"
    ],
    "note": "Низкий ночной маршрут 150 мм; условная метка группы, независимые аккумуляторные светильники E01/E02 описаны отдельно."
  }
];

export const CIRCUITS: Circuit[] = [
  {
    "id": "Q01",
    "label": "Свет A: L01, L02, L06, L07, L08, L11",
    "status": "planned",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. База / расчет",
    "sourceCableNote": "3 x 1,5 к каждой группе",
    "sourceProtectionNote": "Ориентир 6-10 A; АВДТ с отключением L+N"
  },
  {
    "id": "Q02",
    "label": "Свет B: L03, L04, L05, L09, L10, L14",
    "status": "planned",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. База / расчет",
    "sourceCableNote": "3 x 1,5 к каждой группе",
    "sourceProtectionNote": "Ориентир 6-10 A; АВДТ с отключением L+N"
  },
  {
    "id": "Q03",
    "label": "Свет улицы: L12, L13",
    "status": "planned",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. База",
    "sourceCableNote": "3 x 1,5; наружное исполнение",
    "sourceProtectionNote": "Ориентир 6-10 A; расчет"
  },
  {
    "id": "Q04",
    "label": "Все розетки кабинета R01-R04",
    "status": "planned",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. База",
    "sourceCableNote": "3 x 2,5",
    "sourceProtectionNote": "Ориентир до 16 A; расчет"
  },
  {
    "id": "Q05",
    "label": "Розетки спальни R05-R08",
    "status": "planned",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. База",
    "sourceCableNote": "3 x 2,5",
    "sourceProtectionNote": "Ориентир до 16 A; расчет"
  },
  {
    "id": "Q06",
    "label": "Розетки гостиной R09-R12",
    "status": "planned",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. База",
    "sourceCableNote": "3 x 2,5",
    "sourceProtectionNote": "Ориентир до 16 A; расчет"
  },
  {
    "id": "Q07",
    "label": "Кухонный фартук R13",
    "status": "planned",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. База",
    "sourceCableNote": "3 x 2,5",
    "sourceProtectionNote": "Ориентир до 16 A; расчет"
  },
  {
    "id": "Q08",
    "label": "Кухонный фартук R14",
    "status": "planned",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. База",
    "sourceCableNote": "3 x 2,5",
    "sourceProtectionNote": "Ориентир до 16 A; расчет"
  },
  {
    "id": "Q09",
    "label": "Холодильник R15",
    "status": "planned",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. База",
    "sourceCableNote": "3 x 2,5",
    "sourceProtectionNote": "По розетке и нагрузке; до 16 A"
  },
  {
    "id": "Q10",
    "label": "Варочная панель P01",
    "status": "planned",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. База",
    "sourceCableNote": "1 фаза: исходно 3 x 6; иной ввод по проекту",
    "sourceProtectionNote": "По мощности и схеме панели"
  },
  {
    "id": "Q11",
    "label": "Духовой шкаф R18",
    "status": "optional",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. Опция",
    "sourceCableNote": "3 x 2,5 только если достаточно по модели",
    "sourceProtectionNote": "По мощности и подключению"
  },
  {
    "id": "Q12",
    "label": "Посудомоечная машина R17",
    "status": "optional",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. Опция",
    "sourceCableNote": "3 x 2,5",
    "sourceProtectionNote": "По модели; ориентир до 16 A"
  },
  {
    "id": "Q13",
    "label": "Стиральная машина R19",
    "status": "coordination",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. Согласовать зону",
    "sourceCableNote": "3 x 2,5",
    "sourceProtectionNote": "По модели; ориентир до 16 A"
  },
  {
    "id": "Q14",
    "label": "Розетки санузла R20",
    "status": "coordination",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. Согласовать зону",
    "sourceCableNote": "3 x 2,5",
    "sourceProtectionNote": "Ориентир до 16 A; расчет"
  },
  {
    "id": "Q15",
    "label": "Котел P02",
    "status": "planned",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. База трассы",
    "sourceCableNote": "Фазы, жилы и сечение по модели",
    "sourceProtectionNote": "Не назначен: нет мощности котла"
  },
  {
    "id": "Q16",
    "label": "Электронагреватель бака P03",
    "status": "coordination",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. Условная",
    "sourceCableNote": "По наличию ТЭНа и его мощности",
    "sourceProtectionNote": "По модели"
  },
  {
    "id": "Q17",
    "label": "Электрический пол санузла P04",
    "status": "optional",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. Опция",
    "sourceCableNote": "По мощности; отдельный датчик в трубке",
    "sourceProtectionNote": "По расчету"
  },
  {
    "id": "Q18",
    "label": "Вентиляция P05 и вытяжка R16",
    "status": "planned",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. База / уточнить",
    "sourceCableNote": "По паспортам; розеточный участок от 3 x 2,5",
    "sourceProtectionNote": "По пуску и нагрузке"
  },
  {
    "id": "Q19",
    "label": "Кондиционер гостиной P06",
    "status": "reserve",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. Резерв",
    "sourceCableNote": "По схеме выбранного сплита",
    "sourceProtectionNote": "По паспорту"
  },
  {
    "id": "Q20",
    "label": "Кондиционер спальни P07",
    "status": "reserve",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. Резерв",
    "sourceCableNote": "По схеме выбранного сплита",
    "sourceProtectionNote": "По паспорту"
  },
  {
    "id": "Q21",
    "label": "Прихожая R21-R22",
    "status": "planned",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. База",
    "sourceCableNote": "3 x 2,5",
    "sourceProtectionNote": "Ориентир до 16 A; расчет"
  },
  {
    "id": "Q22",
    "label": "Розетки улицы R23-R25",
    "status": "planned",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. База",
    "sourceCableNote": "3 x 2,5; длина / условия уточняются",
    "sourceProtectionNote": "Ориентир до 16 A; расчет"
  },
  {
    "id": "Q23",
    "label": "Приводы штор M01-M05",
    "status": "reserve",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. Резерв",
    "sourceCableNote": "Резерв трасс; для типового мотора 5 x 1,5",
    "sourceProtectionNote": "По типу и числу приводов"
  },
  {
    "id": "Q24",
    "label": "Питание автоматики / блока протечек",
    "status": "planned",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. База",
    "sourceCableNote": "По блокам питания; отдельные DC-ветви",
    "sourceProtectionNote": "По нагрузке и пуску БП"
  },
  {
    "id": "Q25",
    "label": "Слаботочный шкаф, R26, ИБП",
    "status": "planned",
    "note": "Исходная предварительная ведомость. Не является расчётом или подтверждённым выбором аппарата/кабеля. База",
    "sourceCableNote": "3 x 2,5",
    "sourceProtectionNote": "По нагрузке; ориентир до 16 A"
  }
];

export const NETWORK_LINKS: NetworkLink[] = [
  {
    "id": "LAN-01",
    "pointId": "N01",
    "port": "01",
    "panelId": "T1",
    "routeId": "ethernet-01",
    "role": "Компьютер, док, рабочее оборудование, резерв"
  },
  {
    "id": "LAN-02",
    "pointId": "N01",
    "port": "02",
    "panelId": "T1",
    "routeId": "ethernet-02",
    "role": "Компьютер, док, рабочее оборудование, резерв"
  },
  {
    "id": "LAN-03",
    "pointId": "N01",
    "port": "03",
    "panelId": "T1",
    "routeId": "ethernet-03",
    "role": "Компьютер, док, рабочее оборудование, резерв"
  },
  {
    "id": "LAN-04",
    "pointId": "N01",
    "port": "04",
    "panelId": "T1",
    "routeId": "ethernet-04",
    "role": "Компьютер, док, рабочее оборудование, резерв"
  },
  {
    "id": "LAN-05",
    "pointId": "N02",
    "port": "05",
    "panelId": "T1",
    "routeId": "ethernet-05",
    "role": "ТВ, приставка, консоль, резерв; два сверху и два у тумбы"
  },
  {
    "id": "LAN-06",
    "pointId": "N02",
    "port": "06",
    "panelId": "T1",
    "routeId": "ethernet-06",
    "role": "ТВ, приставка, консоль, резерв; два сверху и два у тумбы"
  },
  {
    "id": "LAN-07",
    "pointId": "N02",
    "port": "07",
    "panelId": "T1",
    "routeId": "ethernet-07",
    "role": "ТВ, приставка, консоль, резерв; два сверху и два у тумбы"
  },
  {
    "id": "LAN-08",
    "pointId": "N02",
    "port": "08",
    "panelId": "T1",
    "routeId": "ethernet-08",
    "role": "ТВ, приставка, консоль, резерв; два сверху и два у тумбы"
  },
  {
    "id": "LAN-09",
    "pointId": "N03",
    "port": "09",
    "panelId": "T1",
    "routeId": "ethernet-09",
    "role": "За будущим ТВ, совместно по высоте с R07"
  },
  {
    "id": "LAN-10",
    "pointId": "N03",
    "port": "10",
    "panelId": "T1",
    "routeId": "ethernet-10",
    "role": "За будущим ТВ, совместно по высоте с R07"
  },
  {
    "id": "LAN-11",
    "pointId": "N04",
    "port": "11",
    "panelId": "T1",
    "routeId": "ethernet-11",
    "role": "PoE, потолок центральной части гостиной"
  },
  {
    "id": "LAN-12",
    "pointId": "N05",
    "port": "12",
    "panelId": "T1",
    "routeId": "ethernet-12",
    "role": "PoE, под свесом; проверить распознавание лица днем и ночью"
  },
  {
    "id": "LAN-13",
    "pointId": "N06",
    "port": "13",
    "panelId": "T1",
    "routeId": "ethernet-13",
    "role": "PoE, угол и высота после осмотра участка"
  },
  {
    "id": "LAN-14",
    "pointId": "N07",
    "port": "14",
    "panelId": "T1",
    "routeId": "ethernet-14",
    "role": "PoE только при совместимой панели; отдельно кабель замка по паспорту"
  },
  {
    "id": "LAN-15",
    "pointId": "N08",
    "port": "15",
    "panelId": "T1",
    "routeId": "ethernet-15",
    "role": "Кабель заложить; устройство только по результату измерения покрытия"
  }
];

export const ELECTRICAL_ROUTES: ElectricalRoute[] = [
  {
    "id": "power-R01",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        -3.06
      ],
      [
        -3.05,
        2.25,
        -3.06
      ],
      [
        -3.05,
        0.3,
        -3.06
      ]
    ],
    "circuits": [
      "Q04"
    ],
    "pointIds": [
      "R01"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-R02",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        -3.06
      ],
      [
        -1.95,
        2.25,
        -3.06
      ],
      [
        -1.95,
        1.05,
        -3.06
      ]
    ],
    "circuits": [
      "Q04"
    ],
    "pointIds": [
      "R02"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-R03",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        -0.66018
      ],
      [
        -3.6,
        2.25,
        -0.66018
      ],
      [
        -3.6,
        0.3,
        -0.66018
      ]
    ],
    "circuits": [
      "Q04"
    ],
    "pointIds": [
      "R03"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-R04",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        -1.77
      ],
      [
        -3.81018,
        2.25,
        -1.77
      ],
      [
        -3.81018,
        0.3,
        -1.77
      ]
    ],
    "circuits": [
      "Q04"
    ],
    "pointIds": [
      "R04"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-R05",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        -3.06
      ],
      [
        0.98,
        2.25,
        -3.06
      ],
      [
        0.98,
        0.65,
        -3.06
      ]
    ],
    "circuits": [
      "Q05"
    ],
    "pointIds": [
      "R05"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-R06",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        -3.06
      ],
      [
        3.2,
        2.25,
        -3.06
      ],
      [
        3.2,
        0.65,
        -3.06
      ]
    ],
    "circuits": [
      "Q05"
    ],
    "pointIds": [
      "R06"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-R07",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        -0.66018
      ],
      [
        2.08,
        2.25,
        -0.66018
      ],
      [
        2.08,
        1.3,
        -0.66018
      ]
    ],
    "circuits": [
      "Q05"
    ],
    "pointIds": [
      "R07"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-R08",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        -0.88
      ],
      [
        3.81,
        2.25,
        -0.88
      ],
      [
        3.81,
        0.3,
        -0.88
      ]
    ],
    "circuits": [
      "Q05"
    ],
    "pointIds": [
      "R08"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-R09",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        1.11
      ],
      [
        -1.4075,
        2.25,
        1.11
      ],
      [
        -1.4075,
        1.2,
        1.11
      ]
    ],
    "circuits": [
      "Q06"
    ],
    "pointIds": [
      "R09"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-R10",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.43
      ],
      [
        1.08,
        2.25,
        2.43
      ],
      [
        1.08,
        0.015,
        2.43
      ]
    ],
    "circuits": [
      "Q06"
    ],
    "pointIds": [
      "R10"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-R11",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        1.85
      ],
      [
        -1.4075,
        2.25,
        1.85
      ],
      [
        -1.4075,
        0.25,
        1.85
      ]
    ],
    "circuits": [
      "Q06"
    ],
    "pointIds": [
      "R11"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-R12",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.42
      ],
      [
        3.81,
        2.25,
        2.42
      ],
      [
        3.81,
        0.3,
        2.42
      ]
    ],
    "circuits": [
      "Q06"
    ],
    "pointIds": [
      "R12"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-R13",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        -0.42518
      ],
      [
        1.98,
        2.25,
        -0.42518
      ],
      [
        1.98,
        1.141,
        -0.42518
      ]
    ],
    "circuits": [
      "Q07"
    ],
    "pointIds": [
      "R13"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-R14",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        -0.42518
      ],
      [
        2.31,
        2.25,
        -0.42518
      ],
      [
        2.31,
        1.141,
        -0.42518
      ]
    ],
    "circuits": [
      "Q08"
    ],
    "pointIds": [
      "R14"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-R16",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        -0.42518
      ],
      [
        2.8,
        2.25,
        -0.42518
      ],
      [
        2.8,
        2.03,
        -0.42518
      ]
    ],
    "circuits": [
      "Q18"
    ],
    "pointIds": [
      "R16"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-R21",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        3.06
      ],
      [
        -1.85,
        2.25,
        3.06
      ],
      [
        -1.85,
        0.3,
        3.06
      ]
    ],
    "circuits": [
      "Q21"
    ],
    "pointIds": [
      "R21"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-R22",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.87
      ],
      [
        -3.81018,
        2.25,
        2.87
      ],
      [
        -3.81018,
        1.1,
        2.87
      ]
    ],
    "circuits": [
      "Q21"
    ],
    "pointIds": [
      "R22"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-R23",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        3.85
      ],
      [
        -4.047,
        2.25,
        3.85
      ],
      [
        -4.047,
        0.75,
        3.85
      ]
    ],
    "circuits": [
      "Q22"
    ],
    "pointIds": [
      "R23"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-R24",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        3.85
      ],
      [
        4.047,
        2.25,
        3.85
      ],
      [
        4.047,
        0.75,
        3.85
      ]
    ],
    "circuits": [
      "Q22"
    ],
    "pointIds": [
      "R24"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-R25",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        -3.328
      ],
      [
        -3.78,
        2.25,
        -3.328
      ],
      [
        -3.78,
        0.75,
        -3.328
      ]
    ],
    "circuits": [
      "Q22"
    ],
    "pointIds": [
      "R25"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-P01",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        -0.3
      ],
      [
        2.7,
        2.25,
        -0.3
      ],
      [
        2.7,
        0.65,
        -0.3
      ]
    ],
    "circuits": [
      "Q10"
    ],
    "pointIds": [
      "P01"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-P06",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        -0.42518
      ],
      [
        0.81,
        2.25,
        -0.42518
      ],
      [
        0.81,
        2.3,
        -0.42518
      ]
    ],
    "circuits": [
      "Q19"
    ],
    "pointIds": [
      "P06"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "lighting-L01",
    "kind": "lighting",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        -2.07
      ],
      [
        -1.95,
        2.28,
        -2.07
      ],
      [
        -1.95,
        2.347,
        -2.07
      ]
    ],
    "circuits": [
      "Q01"
    ],
    "pointIds": [
      "L01"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "lighting-L02",
    "kind": "lighting",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        -0.66018
      ],
      [
        -2.55,
        2.28,
        -0.66018
      ],
      [
        -2.55,
        1.65,
        -0.66018
      ]
    ],
    "circuits": [
      "Q01"
    ],
    "pointIds": [
      "L02"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "lighting-L03",
    "kind": "lighting",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        -1.73
      ],
      [
        2.02,
        2.28,
        -1.73
      ],
      [
        2.02,
        2.347,
        -1.73
      ]
    ],
    "circuits": [
      "Q02"
    ],
    "pointIds": [
      "L03"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "lighting-L04",
    "kind": "lighting",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        -3.06
      ],
      [
        0.93,
        2.28,
        -3.06
      ],
      [
        0.93,
        1.12,
        -3.06
      ]
    ],
    "circuits": [
      "Q02"
    ],
    "pointIds": [
      "L04"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "lighting-L05",
    "kind": "lighting",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        -3.06
      ],
      [
        3.2,
        2.28,
        -3.06
      ],
      [
        3.2,
        1.12,
        -3.06
      ]
    ],
    "circuits": [
      "Q02"
    ],
    "pointIds": [
      "L05"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "lighting-L06",
    "kind": "lighting",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        1.31
      ],
      [
        -0.06,
        2.28,
        1.31
      ],
      [
        -0.06,
        3.385,
        1.31
      ]
    ],
    "circuits": [
      "Q01"
    ],
    "pointIds": [
      "L06"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "lighting-L07",
    "kind": "lighting",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        1.51273
      ],
      [
        1.83783,
        2.28,
        1.51273
      ],
      [
        1.83783,
        2.2,
        1.51273
      ]
    ],
    "circuits": [
      "Q01"
    ],
    "pointIds": [
      "L07"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "lighting-L08",
    "kind": "lighting",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        -0.03727
      ],
      [
        2.16,
        2.28,
        -0.03727
      ],
      [
        2.16,
        1.486,
        -0.03727
      ]
    ],
    "circuits": [
      "Q01"
    ],
    "pointIds": [
      "L08"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "lighting-L09",
    "kind": "lighting",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        2.41
      ],
      [
        -2.47,
        2.28,
        2.41
      ],
      [
        -2.47,
        2.347,
        2.41
      ]
    ],
    "circuits": [
      "Q02"
    ],
    "pointIds": [
      "L09"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "lighting-L10",
    "kind": "lighting",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        0.36
      ],
      [
        -2.6,
        2.28,
        0.36
      ],
      [
        -2.6,
        2.347,
        0.36
      ]
    ],
    "circuits": [
      "Q02"
    ],
    "pointIds": [
      "L10"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "lighting-L11",
    "kind": "lighting",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        1.527
      ],
      [
        -2.83751,
        2.28,
        1.527
      ],
      [
        -2.83751,
        1.64,
        1.527
      ]
    ],
    "circuits": [
      "Q01"
    ],
    "pointIds": [
      "L11"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "lighting-L12",
    "kind": "lighting",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        4.54
      ],
      [
        0.06,
        2.28,
        4.54
      ],
      [
        0.06,
        3.27,
        4.54
      ]
    ],
    "circuits": [
      "Q03"
    ],
    "pointIds": [
      "L12"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "lighting-L13",
    "kind": "lighting",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        3.44273
      ],
      [
        1.48783,
        2.28,
        3.44273
      ],
      [
        1.48783,
        1.85,
        3.44273
      ]
    ],
    "circuits": [
      "Q03"
    ],
    "pointIds": [
      "L13"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "lighting-L14",
    "kind": "lighting",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        2.39
      ],
      [
        -1.1,
        2.28,
        2.09
      ],
      [
        -1.02,
        2.28,
        2.09
      ],
      [
        -1.02,
        0.15,
        2.09
      ]
    ],
    "circuits": [
      "Q02"
    ],
    "pointIds": [
      "L14"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "signal-S01",
    "kind": "signal",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        3.06
      ],
      [
        -1.85,
        2.19,
        3.06
      ],
      [
        -1.85,
        0.9,
        3.06
      ]
    ],
    "circuits": [
      "Q02",
      "Q03"
    ],
    "pointIds": [
      "S01"
    ],
    "note": "Условный маршрут сервисного слоя; ввод к прибору и проходы через конструкции не спроектированы. Кнопочная трасса — слаботочная, даже если названы обслуживаемые световые группы.",
    "conceptual": true
  },
  {
    "id": "signal-S02",
    "kind": "signal",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        1.85
      ],
      [
        -1.4075,
        2.19,
        1.85
      ],
      [
        -1.4075,
        0.9,
        1.85
      ]
    ],
    "circuits": [
      "Q01"
    ],
    "pointIds": [
      "S02"
    ],
    "note": "Условный маршрут сервисного слоя; ввод к прибору и проходы через конструкции не спроектированы. Кнопочная трасса — слаботочная, даже если названы обслуживаемые световые группы.",
    "conceptual": true
  },
  {
    "id": "signal-S03",
    "kind": "signal",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        -1.0
      ],
      [
        -0.11774,
        2.19,
        -1.0
      ],
      [
        -0.11774,
        0.9,
        -1.0
      ]
    ],
    "circuits": [
      "Q01"
    ],
    "pointIds": [
      "S03"
    ],
    "note": "Условный маршрут сервисного слоя; ввод к прибору и проходы через конструкции не спроектированы. Кнопочная трасса — слаботочная, даже если названы обслуживаемые световые группы.",
    "conceptual": true
  },
  {
    "id": "signal-S04",
    "kind": "signal",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        -0.66018
      ],
      [
        -3.6,
        2.19,
        -0.66018
      ],
      [
        -3.6,
        0.9,
        -0.66018
      ]
    ],
    "circuits": [
      "Q01"
    ],
    "pointIds": [
      "S04"
    ],
    "note": "Условный маршрут сервисного слоя; ввод к прибору и проходы через конструкции не спроектированы. Кнопочная трасса — слаботочная, даже если названы обслуживаемые световые группы.",
    "conceptual": true
  },
  {
    "id": "signal-S05",
    "kind": "signal",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        -0.66018
      ],
      [
        1.31,
        2.19,
        -0.66018
      ],
      [
        1.31,
        0.9,
        -0.66018
      ]
    ],
    "circuits": [
      "Q02"
    ],
    "pointIds": [
      "S05"
    ],
    "note": "Условный маршрут сервисного слоя; ввод к прибору и проходы через конструкции не спроектированы. Кнопочная трасса — слаботочная, даже если названы обслуживаемые световые группы.",
    "conceptual": true
  },
  {
    "id": "signal-S06",
    "kind": "signal",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        -3.06
      ],
      [
        1.12,
        2.19,
        -3.06
      ],
      [
        1.12,
        0.76,
        -3.06
      ]
    ],
    "circuits": [
      "Q02"
    ],
    "pointIds": [
      "S06"
    ],
    "note": "Условный маршрут сервисного слоя; ввод к прибору и проходы через конструкции не спроектированы. Кнопочная трасса — слаботочная, даже если названы обслуживаемые световые группы.",
    "conceptual": true
  },
  {
    "id": "signal-S07",
    "kind": "signal",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        -3.06
      ],
      [
        3.42,
        2.19,
        -3.06
      ],
      [
        3.42,
        0.76,
        -3.06
      ]
    ],
    "circuits": [
      "Q02"
    ],
    "pointIds": [
      "S07"
    ],
    "note": "Условный маршрут сервисного слоя; ввод к прибору и проходы через конструкции не спроектированы. Кнопочная трасса — слаботочная, даже если названы обслуживаемые световые группы.",
    "conceptual": true
  },
  {
    "id": "signal-S08",
    "kind": "signal",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        0.78
      ],
      [
        -1.4075,
        2.19,
        0.78
      ],
      [
        -1.4075,
        0.9,
        0.78
      ]
    ],
    "circuits": [
      "Q01",
      "Q02"
    ],
    "pointIds": [
      "S08"
    ],
    "note": "Условный маршрут сервисного слоя; ввод к прибору и проходы через конструкции не спроектированы. Кнопочная трасса — слаботочная, даже если названы обслуживаемые световые группы.",
    "conceptual": true
  },
  {
    "id": "signal-S09",
    "kind": "signal",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        -0.42518
      ],
      [
        2.14,
        2.19,
        -0.42518
      ],
      [
        2.14,
        1.14,
        -0.42518
      ]
    ],
    "circuits": [
      "Q01"
    ],
    "pointIds": [
      "S09"
    ],
    "note": "Условный маршрут сервисного слоя; ввод к прибору и проходы через конструкции не спроектированы. Кнопочная трасса — слаботочная, даже если названы обслуживаемые световые группы.",
    "conceptual": true
  },
  {
    "id": "signal-S10",
    "kind": "signal",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        3.06
      ],
      [
        1.52,
        2.19,
        3.06
      ],
      [
        1.52,
        0.9,
        3.06
      ]
    ],
    "circuits": [
      "Q03"
    ],
    "pointIds": [
      "S10"
    ],
    "note": "Условный маршрут сервисного слоя; ввод к прибору и проходы через конструкции не спроектированы. Кнопочная трасса — слаботочная, даже если названы обслуживаемые световые группы.",
    "conceptual": true
  },
  {
    "id": "power-M01",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        -1.747
      ],
      [
        -3.542,
        2.25,
        -1.747
      ],
      [
        -3.542,
        2.26,
        -1.747
      ]
    ],
    "circuits": [
      "Q23"
    ],
    "pointIds": [
      "M01"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-M02",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        -1.747
      ],
      [
        3.548,
        2.25,
        -1.747
      ],
      [
        3.548,
        2.26,
        -1.747
      ]
    ],
    "circuits": [
      "Q23"
    ],
    "pointIds": [
      "M02"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-M03",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        1.453
      ],
      [
        3.548,
        2.25,
        1.453
      ],
      [
        3.548,
        2.26,
        1.453
      ]
    ],
    "circuits": [
      "Q23"
    ],
    "pointIds": [
      "M03"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-M04",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        3.0
      ],
      [
        -1.2,
        2.25,
        3.0
      ],
      [
        -1.2,
        3.08,
        3.0
      ]
    ],
    "circuits": [
      "Q23"
    ],
    "pointIds": [
      "M04"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "power-M05",
    "kind": "power",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        2.39
      ],
      [
        -1.1,
        2.25,
        3.0
      ],
      [
        3.55,
        2.25,
        3.0
      ],
      [
        3.55,
        2.38,
        3.0
      ]
    ],
    "circuits": [
      "Q23"
    ],
    "pointIds": [
      "M05"
    ],
    "note": "Условный маршрут отдельной группы; окончательные отверстия, длина и монтажный узел не заданы.",
    "conceptual": true
  },
  {
    "id": "ethernet-01",
    "kind": "ethernet",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.22,
        2.39
      ],
      [
        -1.121,
        2.22,
        2.39
      ],
      [
        -1.121,
        2.22,
        -3.06
      ],
      [
        -2.56,
        2.22,
        -3.06
      ],
      [
        -2.56,
        0.38,
        -3.06
      ]
    ],
    "circuits": [
      "Q25"
    ],
    "pointIds": [
      "N01"
    ],
    "note": "Ethernet 01: отдельный непрерывный кабель от Т1 к N01. Совпадение коридоров не означает сетевое разветвление; PoE только по совместимости оборудования.",
    "conceptual": true
  },
  {
    "id": "ethernet-02",
    "kind": "ethernet",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.22,
        2.39
      ],
      [
        -1.118,
        2.22,
        2.39
      ],
      [
        -1.118,
        2.22,
        -3.06
      ],
      [
        -2.56,
        2.22,
        -3.06
      ],
      [
        -2.56,
        0.38,
        -3.06
      ]
    ],
    "circuits": [
      "Q25"
    ],
    "pointIds": [
      "N01"
    ],
    "note": "Ethernet 02: отдельный непрерывный кабель от Т1 к N01. Совпадение коридоров не означает сетевое разветвление; PoE только по совместимости оборудования.",
    "conceptual": true
  },
  {
    "id": "ethernet-03",
    "kind": "ethernet",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.22,
        2.39
      ],
      [
        -1.115,
        2.22,
        2.39
      ],
      [
        -1.115,
        2.22,
        -3.06
      ],
      [
        -2.56,
        2.22,
        -3.06
      ],
      [
        -2.56,
        0.38,
        -3.06
      ]
    ],
    "circuits": [
      "Q25"
    ],
    "pointIds": [
      "N01"
    ],
    "note": "Ethernet 03: отдельный непрерывный кабель от Т1 к N01. Совпадение коридоров не означает сетевое разветвление; PoE только по совместимости оборудования.",
    "conceptual": true
  },
  {
    "id": "ethernet-04",
    "kind": "ethernet",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.22,
        2.39
      ],
      [
        -1.112,
        2.22,
        2.39
      ],
      [
        -1.112,
        2.22,
        -3.06
      ],
      [
        -2.56,
        2.22,
        -3.06
      ],
      [
        -2.56,
        0.38,
        -3.06
      ]
    ],
    "circuits": [
      "Q25"
    ],
    "pointIds": [
      "N01"
    ],
    "note": "Ethernet 04: отдельный непрерывный кабель от Т1 к N01. Совпадение коридоров не означает сетевое разветвление; PoE только по совместимости оборудования.",
    "conceptual": true
  },
  {
    "id": "ethernet-05",
    "kind": "ethernet",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.22,
        2.39
      ],
      [
        -1.109,
        2.22,
        2.39
      ],
      [
        -1.109,
        2.22,
        1.58
      ],
      [
        -1.4075,
        2.22,
        1.58
      ],
      [
        -1.4075,
        1.2,
        1.58
      ]
    ],
    "circuits": [
      "Q25"
    ],
    "pointIds": [
      "N02"
    ],
    "note": "Ethernet 05: отдельный непрерывный кабель от Т1 к N02. Совпадение коридоров не означает сетевое разветвление; PoE только по совместимости оборудования.",
    "conceptual": true
  },
  {
    "id": "ethernet-06",
    "kind": "ethernet",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.22,
        2.39
      ],
      [
        -1.106,
        2.22,
        2.39
      ],
      [
        -1.106,
        2.22,
        1.58
      ],
      [
        -1.4075,
        2.22,
        1.58
      ],
      [
        -1.4075,
        1.2,
        1.58
      ]
    ],
    "circuits": [
      "Q25"
    ],
    "pointIds": [
      "N02"
    ],
    "note": "Ethernet 06: отдельный непрерывный кабель от Т1 к N02. Совпадение коридоров не означает сетевое разветвление; PoE только по совместимости оборудования.",
    "conceptual": true
  },
  {
    "id": "ethernet-07",
    "kind": "ethernet",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.22,
        2.39
      ],
      [
        -1.103,
        2.22,
        2.39
      ],
      [
        -1.103,
        2.22,
        1.58
      ],
      [
        -1.4075,
        2.22,
        1.58
      ],
      [
        -1.4075,
        1.2,
        1.58
      ]
    ],
    "circuits": [
      "Q25"
    ],
    "pointIds": [
      "N02"
    ],
    "note": "Ethernet 07: отдельный непрерывный кабель от Т1 к N02. Совпадение коридоров не означает сетевое разветвление; PoE только по совместимости оборудования.",
    "conceptual": true
  },
  {
    "id": "ethernet-08",
    "kind": "ethernet",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.22,
        2.39
      ],
      [
        -1.1,
        2.22,
        2.39
      ],
      [
        -1.1,
        2.22,
        1.58
      ],
      [
        -1.4075,
        2.22,
        1.58
      ],
      [
        -1.4075,
        1.2,
        1.58
      ]
    ],
    "circuits": [
      "Q25"
    ],
    "pointIds": [
      "N02"
    ],
    "note": "Ethernet 08: отдельный непрерывный кабель от Т1 к N02. Совпадение коридоров не означает сетевое разветвление; PoE только по совместимости оборудования.",
    "conceptual": true
  },
  {
    "id": "ethernet-09",
    "kind": "ethernet",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.22,
        2.39
      ],
      [
        -1.097,
        2.22,
        2.39
      ],
      [
        -1.097,
        2.22,
        -0.66018
      ],
      [
        2.34,
        2.22,
        -0.66018
      ],
      [
        2.34,
        1.3,
        -0.66018
      ]
    ],
    "circuits": [
      "Q25"
    ],
    "pointIds": [
      "N03"
    ],
    "note": "Ethernet 09: отдельный непрерывный кабель от Т1 к N03. Совпадение коридоров не означает сетевое разветвление; PoE только по совместимости оборудования.",
    "conceptual": true
  },
  {
    "id": "ethernet-10",
    "kind": "ethernet",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.22,
        2.39
      ],
      [
        -1.094,
        2.22,
        2.39
      ],
      [
        -1.094,
        2.22,
        -0.66018
      ],
      [
        2.34,
        2.22,
        -0.66018
      ],
      [
        2.34,
        1.3,
        -0.66018
      ]
    ],
    "circuits": [
      "Q25"
    ],
    "pointIds": [
      "N03"
    ],
    "note": "Ethernet 10: отдельный непрерывный кабель от Т1 к N03. Совпадение коридоров не означает сетевое разветвление; PoE только по совместимости оборудования.",
    "conceptual": true
  },
  {
    "id": "ethernet-11",
    "kind": "ethernet",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.22,
        2.39
      ],
      [
        -1.091,
        2.22,
        2.39
      ],
      [
        -1.091,
        2.22,
        0.39
      ],
      [
        0.14,
        2.22,
        0.39
      ],
      [
        0.14,
        3.365,
        0.39
      ]
    ],
    "circuits": [
      "Q25"
    ],
    "pointIds": [
      "N04"
    ],
    "note": "Ethernet 11: отдельный непрерывный кабель от Т1 к N04. Совпадение коридоров не означает сетевое разветвление; PoE только по совместимости оборудования.",
    "conceptual": true
  },
  {
    "id": "ethernet-12",
    "kind": "ethernet",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.22,
        2.39
      ],
      [
        -1.088,
        2.22,
        2.39
      ],
      [
        -1.088,
        2.22,
        3.33
      ],
      [
        -3.47,
        2.22,
        3.33
      ],
      [
        -3.47,
        2.18,
        3.33
      ]
    ],
    "circuits": [
      "Q25"
    ],
    "pointIds": [
      "N05"
    ],
    "note": "Ethernet 12: отдельный непрерывный кабель от Т1 к N05. Совпадение коридоров не означает сетевое разветвление; PoE только по совместимости оборудования.",
    "conceptual": true
  },
  {
    "id": "ethernet-13",
    "kind": "ethernet",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.22,
        2.39
      ],
      [
        -1.085,
        2.22,
        2.39
      ],
      [
        -1.085,
        2.22,
        -3.353
      ],
      [
        3.68,
        2.22,
        -3.353
      ],
      [
        3.68,
        2.18,
        -3.353
      ]
    ],
    "circuits": [
      "Q25"
    ],
    "pointIds": [
      "N06"
    ],
    "note": "Ethernet 13: отдельный непрерывный кабель от Т1 к N06. Совпадение коридоров не означает сетевое разветвление; PoE только по совместимости оборудования.",
    "conceptual": true
  },
  {
    "id": "ethernet-14",
    "kind": "ethernet",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.22,
        2.39
      ],
      [
        -1.082,
        2.22,
        2.39
      ],
      [
        -1.082,
        2.22,
        3.33
      ],
      [
        -1.89,
        2.22,
        3.33
      ],
      [
        -1.89,
        1.35,
        3.33
      ]
    ],
    "circuits": [
      "Q25"
    ],
    "pointIds": [
      "N07"
    ],
    "note": "Ethernet 14: отдельный непрерывный кабель от Т1 к N07. Совпадение коридоров не означает сетевое разветвление; PoE только по совместимости оборудования.",
    "conceptual": true
  },
  {
    "id": "ethernet-15",
    "kind": "ethernet",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.22,
        2.39
      ],
      [
        -1.079,
        2.22,
        2.39
      ],
      [
        -1.079,
        2.22,
        3.33
      ],
      [
        3.57,
        2.22,
        3.33
      ],
      [
        3.57,
        2.1,
        3.33
      ]
    ],
    "circuits": [
      "Q25"
    ],
    "pointIds": [
      "N08"
    ],
    "note": "Ethernet 15: отдельный непрерывный кабель от Т1 к N08. Совпадение коридоров не означает сетевое разветвление; PoE только по совместимости оборудования.",
    "conceptual": true
  },
  {
    "id": "rs485-climate",
    "kind": "rs485",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.16,
        2.39
      ],
      [
        -1.18,
        2.16,
        2.39
      ],
      [
        -1.18,
        2.16,
        -1.32
      ],
      [
        -0.11774,
        2.16,
        -1.32
      ],
      [
        -0.11774,
        1.35,
        -1.32
      ],
      [
        -0.11774,
        2.16,
        -1.32
      ],
      [
        0.11726,
        2.16,
        -1.34
      ],
      [
        0.11726,
        1.35,
        -1.34
      ],
      [
        0.11726,
        2.16,
        -1.34
      ],
      [
        -0.1,
        2.16,
        -0.42518
      ],
      [
        -0.1,
        1.35,
        -0.42518
      ],
      [
        -0.1,
        2.16,
        -0.42518
      ]
    ],
    "circuits": [
      "Q24"
    ],
    "pointIds": [
      "T01",
      "T02",
      "T03"
    ],
    "note": "Последовательная концептуальная шина Т1 → T01 → T02 → T03. Кабель/терминация и ответвления определяются выбранными датчиками; не звезда Ethernet.",
    "conceptual": true
  },
  {
    "id": "signal-H01",
    "kind": "signal",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        -0.42518
      ],
      [
        -3.01,
        2.19,
        -0.42518
      ],
      [
        -3.01,
        1.42,
        -0.42518
      ]
    ],
    "circuits": [
      "Q24"
    ],
    "pointIds": [
      "H01"
    ],
    "note": "Концептуальная выделенная сигнальная ветвь. Интерфейс и питание по выбранной модели; протечка — в автономный блок защиты, не обязательный вход HA.",
    "conceptual": true
  },
  {
    "id": "signal-O01",
    "kind": "signal",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        2.44
      ],
      [
        -2.42,
        2.19,
        2.44
      ],
      [
        -2.42,
        2.35,
        2.44
      ]
    ],
    "circuits": [
      "Q24"
    ],
    "pointIds": [
      "O01"
    ],
    "note": "Концептуальная выделенная сигнальная ветвь. Интерфейс и питание по выбранной модели; протечка — в автономный блок защиты, не обязательный вход HA.",
    "conceptual": true
  },
  {
    "id": "signal-O02",
    "kind": "signal",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        1.04
      ],
      [
        -0.57,
        2.19,
        1.04
      ],
      [
        -0.57,
        3.245,
        1.04
      ]
    ],
    "circuits": [
      "Q24"
    ],
    "pointIds": [
      "O02"
    ],
    "note": "Концептуальная выделенная сигнальная ветвь. Интерфейс и питание по выбранной модели; протечка — в автономный блок защиты, не обязательный вход HA.",
    "conceptual": true
  },
  {
    "id": "signal-W01",
    "kind": "signal",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        0.46273
      ],
      [
        1.39783,
        2.19,
        0.46273
      ],
      [
        1.39783,
        0.035,
        0.46273
      ]
    ],
    "circuits": [
      "Q24"
    ],
    "pointIds": [
      "W01"
    ],
    "note": "Концептуальная выделенная сигнальная ветвь. Интерфейс и питание по выбранной модели; протечка — в автономный блок защиты, не обязательный вход HA.",
    "conceptual": true
  },
  {
    "id": "signal-W02",
    "kind": "signal",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        0.97
      ],
      [
        -3.32,
        2.19,
        0.97
      ],
      [
        -3.32,
        0.025,
        0.97
      ]
    ],
    "circuits": [
      "Q24"
    ],
    "pointIds": [
      "W02"
    ],
    "note": "Концептуальная выделенная сигнальная ветвь. Интерфейс и питание по выбранной модели; протечка — в автономный блок защиты, не обязательный вход HA.",
    "conceptual": true
  },
  {
    "id": "signal-W03",
    "kind": "signal",
    "points": [
      [
        -3.28018,
        1.2,
        2.39
      ],
      [
        -3.28018,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        2.39
      ],
      [
        -1.1,
        2.19,
        -0.2
      ],
      [
        -2.6,
        2.19,
        -0.2
      ],
      [
        -2.6,
        0.025,
        -0.2
      ]
    ],
    "circuits": [
      "Q24"
    ],
    "pointIds": [
      "W03"
    ],
    "note": "Концептуальная выделенная сигнальная ветвь. Интерфейс и питание по выбранной модели; протечка — в автономный блок защиты, не обязательный вход HA.",
    "conceptual": true
  }
];
