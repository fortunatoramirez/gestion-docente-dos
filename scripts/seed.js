require('dotenv').config();

const db = require('../src/config/database');
const { normalizeCatalogName } = require('../src/utils/text');

const semester = 'Ene-Jun 2026';

const professors = [
  {
    employeeNumber: '2835',
    fullName: 'AGUILERA GUERRERO JORGE NATANAEL',
    assignments: [
      ['DISENO DE ELEMENTOS DE MAQUINA ASISTIDO POR COMPUTADORA', 'IE7E', 5]
    ]
  },
  {
    employeeNumber: '2675',
    fullName: 'ALDRETE MALDONADO CHRISTIAN',
    assignments: [
      ['MAQUINAS ELECTRICAS', 'IE6A', 5],
      ['ELECTRONICA ANALOGICA', 'EM4C', 5],
      ['ELECTRONICA ANALOGICA', 'EM4D', 5],
      ['ANALISIS NUMERICO', 'IE4A', 5],
      ['CONTROLADORES LOGICOS PROGRAMABLES', 'IE8A', 5],
      ['SISTEMAS DE VISION EN PROCESOS DE AUTOMATIZACION', 'IE9E', 5],
      ['ELECTRONICA BASICA', 'MPIM-0101', 6]
    ]
  },
  {
    employeeNumber: '2106',
    fullName: 'CABALLERO GUADARRAMA EDUARDO ENRIQUE',
    assignments: [['ELECTRONEUMATICA APLICADA', 'IE8E', 6]]
  },
  {
    employeeNumber: '138',
    fullName: 'CAMPOS HERNANDEZ PAUL JAVIER',
    assignments: [
      ['CIRCUITOS ELECTRICOS II', 'IE5A', 5],
      ['CIRCUITOS Y MAQUINAS ELECTRICAS', 'BM4A', 6]
    ]
  },
  {
    employeeNumber: '176',
    fullName: 'CARDENAS VALDEZ JOSE RICARDO',
    assignments: [
      ['SEMINARIO DE INVESTIGACION', 'DC02', 16],
      ['INTRODUCCION A LAS TELECOMUNICACIONES', 'IE7A', 5],
      ['SENSORES Y ACTUADORES', 'BM6A', 5],
      ['TEMAS SELECTOS II', 'MC02', 6],
      ['SEMINARIO DE INVESTIGACION I', 'MC01', 4]
    ]
  },
  {
    employeeNumber: '116',
    fullName: 'CAZAREZ CASTRO NOHE RAMON',
    assignments: [
      ['PROYECTO DE INVESTIGACION IV', 'DC10', 16],
      ['ESTADISTICA APLICADA AL DISENO DE EXPERIMENTOS', 'MC06', 6],
      ['PROGRAMACION', 'MC37', 6],
      ['TEMAS SELECTOS I', 'MC36', 6],
      ['SEMINARIO DE INVESTIGACION II', 'MC13', 4],
      ['SEMINARIO DE INVESTIGACION III', 'MC35', 4]
    ]
  },
  {
    employeeNumber: '2184',
    fullName: 'CERDA SUMBARDA YADIRA DENISSE',
    assignments: [
      ['FENOMENOS DE TRANSPORTE EN BIOSISTEMAS', 'BM4A', 5],
      ['FENOMENOS DE TRANSPORTE EN BIOSISTEMAS', 'BM4B', 5]
    ]
  },
  {
    employeeNumber: '207',
    fullName: 'CORIA DE LOS RIOS LUIS NESTOR',
    assignments: [
      ['CONTROL I', 'IE5A', 5],
      ['INSTRUMENTACION', 'IE6A', 5],
      ['SEMINARIO DE INVESTIGACION', 'DC04', 16],
      ['TESIS', 'DC13', 52],
      ['ANALISIS Y CONTROL DE SISTEMAS NO LINEALES', 'MC18', 6],
      ['SEMINARIO DE INVESTIGACION II', 'MC16', 4],
      ['SEMINARIO DE INVESTIGACION III', 'MC31', 4]
    ]
  },
  {
    employeeNumber: '196',
    fullName: 'CORRAL DOMINGUEZ ANGEL HUMBERTO',
    assignments: [
      ['MICROCONTROLADORES', 'IE7A', 5],
      ['ELECTRONICA DE POTENCIA', 'IE7A', 5],
      ['ELECTRONICA ANALOGICA', 'BM5B', 5],
      ['MICROCONTROLADORES', 'BM6A', 5]
    ]
  },
  {
    employeeNumber: '274',
    fullName: 'ESCOBEDO MITRE DANIEL',
    assignments: [
      ['CIRCUITOS ELECTRICOS I', 'IE4B', 5],
      ['TEORIA ELECTROMAGNETICA', 'IE5A', 5],
      ['OPTICA Y ONDAS', 'BM4A', 5]
    ]
  },
  {
    employeeNumber: '334',
    fullName: 'GAMBOA LOAIZA DIANA',
    assignments: [
      ['TALLER DE INVESTIGACION II', 'IE9A', 4],
      ['ALGEBRA LINEAL', 'SC2A', 5],
      ['MEDICIONES ELECTRICAS', 'BM3B', 3]
    ]
  },
  {
    employeeNumber: '2208',
    fullName: 'GARCIA OLAIZ GEMA DANIRA',
    assignments: [['BIOQUIMICA', 'BM3A', 6]]
  },
  {
    employeeNumber: '2982',
    fullName: 'GARZON FONTECHA ANGELICA MARIA',
    assignments: [
      ['QUIMICA', 'IE1R', 4],
      ['FISICA DE SEMICONDUCTORES', 'IE4A', 5],
      ['PROPIEDADES DE LOS MATERIALES', 'BM6A', 4, 'IBC-1025']
    ]
  },
  {
    employeeNumber: '3063',
    fullName: 'GONZALEZ VILLA MONTSERRAT',
    assignments: [['ANATOMIA Y FISIOLOGIA II', 'BM4B', 5]]
  },
  {
    employeeNumber: '469',
    fullName: 'LARES BOCANEGRA VALENTE ATANACIO',
    assignments: [
      ['FUNDAMENTOS DE INVESTIGACION', 'BM1RA', 4],
      ['MEDICIONES ELECTRICAS', 'IE2A', 5],
      ['MEDICIONES ELECTRICAS', 'IE2B', 5],
      ['DESARROLLO Y EVALUACION DE PROYECTOS', 'IE10A', 3],
      ['MEDICIONES ELECTRICAS', 'BM3A', 3]
    ]
  },
  {
    employeeNumber: '2397',
    fullName: 'LOPEZ RENTERIA JORGE ANTONIO',
    assignments: [
      ['SEMINARIO DE INVESTIGACION', 'DC01', 16],
      ['MODELADO MATEMATICO', 'MC07', 6],
      ['SINCRONIZACION DE SISTEMAS CAOTICOS', 'MC12', 6]
    ]
  },
  {
    employeeNumber: '2774',
    fullName: 'LOZADA ROMERO ADRIEL LARIZA',
    assignments: [
      ['INSTRUMENTACION BIOMEDICA', 'BM7A', 5],
      ['GESTION DE LA CALIDAD', 'IE9E', 5]
    ]
  },
  {
    employeeNumber: '2036',
    fullName: 'MALDONADO ROBLES YAZMIN',
    assignments: [
      ['DISENO DIGITAL CON VHDL', 'IE6A', 5],
      ['SISTEMAS DIGITALES APLICADOS PARA EL PROCESAMIENTO DE SENALES', 'MC15', 6],
      ['INSTRUMENTACION Y ADQUISICION DE DATOS', 'MC39', 6],
      ['SEMINARIO DE INVESTIGACION II', 'MC08', 4],
      ['SEMINARIO DE INVESTIGACION III', 'MC33', 4]
    ]
  },
  {
    employeeNumber: '2030',
    fullName: 'MANZANAREZ GUEVARA LIZBETH ALEXIS',
    assignments: [['ANATOMIA Y FISIOLOGIA I', 'BM3A', 5]]
  },
  {
    employeeNumber: '538',
    fullName: 'MARTINEZ GRACILIANO ARMANDO',
    assignments: [
      ['PROGRAMACION ESTRUCTURADA', 'IE1A', 5],
      ['FUNDAMENTOS DE PROGRAMACION', 'BM1A', 5]
    ]
  },
  {
    employeeNumber: '2535',
    fullName: 'MORENO GRIJALVA GRECIA ISIS',
    assignments: [
      ['INTRODUCCION A LA INGENIERIA BIOMEDICA', 'BM1A', 4],
      ['FISICA MEDICA', 'BM5A', 5]
    ]
  },
  {
    employeeNumber: '3066',
    fullName: 'NATION MORALES JOEL LEE',
    assignments: [
      ['PROGRAMACION ESTRUCTURADA', 'IE1R', 5],
      ['PROGRAMACION ORIENTADA A OBJETOS', 'BM2A', 4],
      ['PROGRAMACION ORIENTADA A OBJETOS', 'BM2B', 4],
      ['PROGRAMACION ORIENTADA A OBJETOS', 'BM2C', 4],
      ['FUNDAMENTOS DE PROGRAMACION', 'BM1RA', 5]
    ]
  },
  {
    employeeNumber: '658',
    fullName: 'OLIVAS ONTIVEROS JOSE ANGEL',
    assignments: [['OPTOELECTRONICA', 'IE8A', 5]]
  },
  {
    employeeNumber: '724',
    fullName: 'PONCE OLIVA CIPRIANO',
    assignments: [
      ['CIRCUITOS ELECTRICOS I', 'IE4A', 5],
      ['DIODOS Y TRANSISTORES', 'IE5A', 5],
      ['DISENO CON TRANSISTORES', 'IE6A', 5],
      ['CIRCUITOS Y MAQUINAS ELECTRICAS', 'BM4B', 6]
    ]
  },
  {
    employeeNumber: '696',
    fullName: 'PRECIADO GUILLEN EDUARDO',
    assignments: [
      ['ADMINISTRACION DE OPERACIONES', 'IE9E', 5],
      ['MANUFACTURA ESBELTA', 'IE9E', 5],
      ['TOPICOS DE INGENIERIA DE MANUFACTURA', 'IE9E', 5],
      ['TALLER DE LIDERAZGO', 'IE8E', 3]
    ]
  },
  {
    employeeNumber: '727',
    fullName: 'PUGA GUZMAN SERGIO ALBERTO',
    assignments: [
      ['PROYECTO DE INVESTIGACION II', 'DC07', 16],
      ['SISTEMAS ELECTRONICOS DE INSTRUMENTACION Y CONTROL', 'MC05', 6]
    ]
  },
  {
    employeeNumber: '2289',
    fullName: 'RAMIREZ ARZATE FORTUNATO',
    assignments: [
      ['PROGRAMACION VISUAL', 'IE2B', 5],
      ['SISTEMAS DE COMPUTO Y REDES', 'BM6A', 4],
      ['TECNOLOGIAS DE BASES DE DATOS', 'BM5A', 4],
      ['INTRODUCCION A CIENCIA DE DATOS', 'BM8E', 5]
    ]
  },
  {
    employeeNumber: '757',
    fullName: 'RAMIREZ VILLALOBOS RAMON',
    assignments: [
      ['AMPLIFICADORES OPERACIONALES', 'IE7A', 5],
      ['PROYECTO DE INGENIERIA BIOMEDICA', 'BM10', 4],
      ['SEMINARIO DE INVESTIGACION I', 'MC04', 4],
      ['TESIS', 'MC29', 40]
    ]
  },
  {
    employeeNumber: '865',
    fullName: 'SERRANO PEREZ JOSUE',
    assignments: [['CONTROL ESTADISTICO DE CALIDAD', 'IE8E', 5]]
  },
  {
    employeeNumber: '871',
    fullName: 'SORIA ARTECHE BERTHA ALICIA',
    assignments: [['ANATOMIA Y FISIOLOGIA II', 'BM4A', 5]]
  },
  {
    employeeNumber: '888',
    fullName: 'SOTELO OROZCO ARTURO',
    assignments: [
      ['INSTRUMENTACION VIRTUAL', 'BM6A', 4],
      ['ELECTRONICA ANALOGICA', 'BM5A', 5],
      ['AUTOMATIZACION ROBOTICA', 'IE9E', 6]
    ]
  },
  {
    employeeNumber: '2861',
    fullName: 'TORRES CORTES NOELIA ARACELI',
    assignments: [['TEMAS SELECTOS I', 'MC10', 6]]
  },
  {
    employeeNumber: '922',
    fullName: 'TRUJILLO REYES LEONARDO',
    assignments: [
      ['PROYECTO DE INVESTIGACION I', 'DC06', 16],
      ['TESIS', 'DC12', 52],
      ['PROGRAMACION VISUAL', 'IE2A', 5],
      ['RECONOCIMIENTO DE PATRONES', 'MC09', 6],
      ['SEMINARIO DE INVESTIGACION II', 'MC19', 4]
    ]
  },
  {
    employeeNumber: '956',
    fullName: 'VALLE TRUJILLO PAUL ANTONIO',
    assignments: [
      ['SEMINARIO DE INVESTIGACION', 'DC03', 16],
      ['PROYECTO DE INVESTIGACION II', 'DC08', 16],
      ['MODELADO DE SISTEMAS FISIOLOGICOS', 'BM7A', 5],
      ['TEMAS SELECTOS I', 'MC17', 6],
      ['GEMELOS DIGITALES', 'BM8E', 5]
    ]
  },
  {
    employeeNumber: '932',
    fullName: 'VAZQUEZ ALCARAZ GILBERTO ENRICO',
    assignments: [
      ['AMPLIFICADORES DE BIOSENALES', 'BM6A', 5],
      ['PROCESAMIENTO DE SENALES DIGITALES', 'BM8A', 5],
      ['SENALES Y SISTEMAS', 'IE7A', 5],
      ['TOPICOS SELECTOS DE MECATRONICA INDUSTRIAL', 'IE8E', 5]
    ]
  },
  {
    employeeNumber: '1007',
    fullName: 'Z. FLORES LOPEZ CELIA',
    assignments: [
      ['FUNDAMENTOS DE QUIMICA ORGANICA', 'BM2A', 5],
      ['QUIMICA INORGANICA', 'BM1A', 5]
    ]
  }
];

function careerFromGroup(groupCode) {
  const group = String(groupCode || '').toUpperCase();
  if (group.startsWith('BM')) return 'Ingenieria Biomedica';
  if (group.startsWith('IE')) return 'Ingenieria Electronica';
  if (group.startsWith('EM')) return 'Ingenieria Electromecanica';
  if (group.startsWith('SC')) return 'Sistemas Computacionales';
  if (group.startsWith('MC') || group.startsWith('DC') || group.startsWith('MPIM')) return 'Posgrado';
  return null;
}

async function upsertProfessor(connection, professor) {
  const normalizedProfessor = {
    ...professor,
    fullName: normalizeCatalogName(professor.fullName)
  };

  const [result] = await connection.execute(
    `INSERT INTO professors (employee_number, full_name, department)
     VALUES (:employeeNumber, :fullName, 'DIEE')
     ON DUPLICATE KEY UPDATE
       full_name = VALUES(full_name),
       department = VALUES(department),
       active = 1,
       id = LAST_INSERT_ID(id)`,
    normalizedProfessor
  );

  return result.insertId;
}

async function upsertSubject(connection, name, groupCode, credits, subjectCode = null) {
  const normalizedName = normalizeCatalogName(name);
  const [result] = await connection.execute(
    `INSERT INTO subjects (name, subject_code, credits)
     VALUES (:name, :subjectCode, :credits)
     ON DUPLICATE KEY UPDATE
       subject_code = COALESCE(VALUES(subject_code), subject_code),
       credits = VALUES(credits),
       id = LAST_INSERT_ID(id)`,
    {
      name: normalizedName,
      subjectCode,
      credits,
      groupCode
    }
  );

  return result.insertId;
}

async function upsertAssignment(connection, professorId, subjectId, groupCode) {
  await connection.execute(
    `INSERT INTO teaching_assignments (professor_id, subject_id, group_code, career, semester)
     VALUES (:professorId, :subjectId, :groupCode, :career, :semester)
     ON DUPLICATE KEY UPDATE
       career = VALUES(career),
       active = 1`,
    {
      professorId,
      subjectId,
      groupCode,
      career: careerFromGroup(groupCode),
      semester
    }
  );
}

async function main() {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    for (const professor of professors) {
      const professorId = await upsertProfessor(connection, professor);

      for (const assignment of professor.assignments) {
        const [name, groupCode, credits, subjectCode] = assignment;
        const subjectId = await upsertSubject(connection, name, groupCode, credits, subjectCode || null);
        await upsertAssignment(connection, professorId, subjectId, groupCode);
      }
    }

    await connection.commit();
    console.log(`Seed completado: ${professors.length} docentes.`);
  } catch (error) {
    await connection.rollback();
    console.error(error);
    process.exitCode = 1;
  } finally {
    connection.release();
    await db.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  professors,
  semester,
  careerFromGroup
};
