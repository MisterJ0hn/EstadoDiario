Cambia la firma de civil y familia

Familia endpoint consultar_familia
{
    "exito": true,
    "code": 200,
    "movimientos":[
        {
            "folio": 1,
            // "folio" = parte numerica. "folio_texto" = folio tal cual lo muestra PJUD:
            // "1" normalmente, o "[6E]" para los movimientos de un exhorto (numerados
            // aparte, intercalados por fecha; un mismo "[NE]" puede repetirse si la causa
            // tiene mas de un exhorto).
            "folio_texto": "1",
            // "doc" es un array: 0, 1 o varios documentos por folio (columna "Doc.").
            "doc": [],
            "anexo": [],
            "etapa":"Mandamiento",
            "estado":"Firmado",
            "tramite":"Actuación Receptor",
            "descripcion_tramite": "NOTIFICACIÓN DE DEMANDA (Exitosa) Diligencia:07/04/2026 17:10",
            "fecha_tramite": "10/04/2026 (07/04/2026)",
            # Inicio Actualizacion 14-09-2026
            "georeferencia": { #si existe georeferencia, coloca un icono de mundo que al presionar, muestre un popup con tres pestañas: mapa (mostrara un mapa situado segun la latitud y  longitud ), imagenes que mostrará la imagen contenida en img (aplica un carrusel cuando sean mas de una imagen)
                "mapa" : { 
                    "latitud":"3", #id="latitud"
                    "longitud":"33",#id="longitud"
                    "corrector":"10" #id="corrector"
                },
                "imagenes":[
                    {
                        "img":"https://api-pjud.temposoft.cl/public/GUID.[jpg|png|gif]" 
                    },
                    {
                        "img":"https://api-pjud.temposoft.cl/public/GUID.[jpg|png|gif]"
                    } 
                ],
                "videos":[] # por el momento estará vacío. no encuentro ejemplos de que es lo que llega.
            }
            # Fin Actualizacion 14-09-2026
        },

    
    En civil:
    endpoint consultar_civil:
    {
    "exito": true,
    "code": 200,
    {
        "identificador": [GUID],
        "estado": "Sincronizando"|"Completo",
        "detalle_estado": "Obteniendo historia de cuaderno Principal", // paso actual mientras estado=Sincronizando; null cuando estado=Completo
        "fecha_ultima_sincronizacion": "2026-08-10",
        "rol": "C-11247-2026", #ROL
        "fecha_ingreso":"30/01/2026", #F. Ing.
        "caratula": "PROMOTORA CMR FALABELLA S", #nO TIENE TITULO EN EL MODAL, PERO ESTA AL LADO DEL F. Ing.
        "est_adm": "Sin archivar", #Est. Adm.
        "proceso": "Ejecutivo Obligación de Dar", #Proc.
        "ubicacion": "Digital", #Ubicación
        "estado_proceso": "Tramitación", #Estado Proc.
        "etapa":"1 Notificación demanda y su proveído", #Etapa
        "tribunal":"1° Juzgado Civil de Valparaíso", #Tribunal
        # Inicio Actualización 15-09-2026. debes pintar en la cabecera estos datos nuevos que llegarán. 
        "causa_origen": {
            "rol":"C-1964-2026",
            "tribunal": "4 ° Juzgado de Letras Civil de Antofagasta"
        },
        # Fin Actualización


endpoint consultar_movimientos_civil:
{
    "exito": true,
    "code": 200,
    "historia":[
        {
            "folio": 1,
            // "folio" = parte numerica. "folio_texto" = folio tal cual lo muestra PJUD:
            // "1" normalmente, o "[6E]" para los movimientos de un exhorto (numerados
            // aparte, intercalados por fecha; un mismo "[NE]" puede repetirse si la causa
            // tiene mas de un exhorto).
            "folio_texto": "1",
            // "doc" es un array: 0, 1 o varios documentos por folio (columna "Doc.").
            "doc": [],
            "anexo": [],
            "etapa":"Mandamiento",
            "tramite":"Actuación Receptor",
            "descripcion_tramite": "NOTIFICACIÓN DE DEMANDA (Exitosa) Diligencia:07/04/2026 17:10",
            "fecha_tramite": "10/04/2026 (07/04/2026)",
            "foja": 0
        },
        {
            "folio": 2,
            "doc":[
                {"doc":"https://api-pjud.temposoft.cl/public/historia_folio2_.pdf"},
                {"doc":"https://api-pjud.temposoft.cl/public/historia_folio2_doc2_.pdf"}
            ],
            "anexo": [
                {
                    "doc":"https://api-pjud.temposoft.cl/public/historia_anexo1_folio2_.pdf",
                    "fecha": "24/02/2025",
                    "referencia": "Mandato"
                },
                {
                    "doc":"https://api-pjud.temposoft.cl/public/historia_anexo2_folio2_.pdf",
                    "fecha": "24/02/2025",
                    "referencia": "Mandato"
                }
            ],
            "etapa":"Mandamiento",
            "tramite":"",
            "descripcion_tramite": "Mandamiento",
            "fecha_tramite": "05/02/2026",
            "foja": 1
        }
    ],
    "litigantes":[
        {
            "participante": "AB.DDO",
            "rut":"18101257-9",
            "persona": "NATURAL",
            "razon_social":"LUIS ALBERTO VERA MAHUZIER (Poder Simple)"
        },
        {
            "participante": "AB.DTE",
            "rut":"18431792-3",
            "persona": "NATURAL",
            "razon_social":"NICOLÁS ALEJANDRO MUÑOZ FERNÁNDEZ (Sin Acreditacion)"
        },
        {
            "participante": "DTE",
            "rut":"97030000-7",
            "persona": "JURIDICA",
            "razon_social":"BANCO DEL ESTADO D E CHILE"
        }
    ],
    "notificaciones":[
        {
            "rol":"C-11247-2026",
            "estado_notificacion": "Realizada",
            "tipo_notificacion":"mail",
            "fecha_tramite": "30/04/2025",
            "tipo_part": "AB.DTE",
            "nombre":"NICOLÁS ALEJANDRO MUÑOZ FERNÁNDEZ",
            "tramite":"resolución",
            "observacion_fallida": ""
        },
        {
            "rol":"C-11247-2026",
            "estado_notificacion": "Realizada",
            "tipo_notificacion":"mail",
            "fecha_tramite": "30/04/2025",
            "tipo_part": "AB.DTE",
            "nombre":"GONZALO PATRICIO DROGUETT MARCUELLO",
            "tramite":"resolución",
            "observacion_fallida": ""
        },
        {
            "rol":"C-11247-2026",
            "estado_notificacion": "Realizada",
            "tipo_notificacion":"mail",
            "fecha_tramite": "30/04/2025",
            "tipo_part": "AB.DDO",
            "nombre":"LUIS ALBERTO VERA MAHUZIER",
            "tramite":"resolución",
            "observacion_fallida": ""
        }
    ],
    "escritos_resolver":[
        {
            "doc":"https://api-pjud.temposoft.cl/public/historia_escrito1_.pdf",
            "anexo":"",
            "fecha_ingreso":"18/08/2026",
            "tipo_escrito": "Curso progresivo a los autos",
            "solicitante": "Demandante"
        }
    ],
    "exhortos":[
        {
            "rol_origen":"C-11247-2026",
            "tipo_exhorto": "Exhorto",
            "rol_destino":[
                {
                    "nombre": "E-2417-2025",
                    "roles": [
                        {
                            "doc":"https://api-pjud.temposoft.cl/public/historia_escrito1_.pdf",
                            "fecha":"27/11/2025",
                            "referencia":"Folio:11 Devuelve con resultado negativo",
                            "tramite":"Resolución"
                        },
                        {
                            "doc":"https://api-pjud.temposoft.cl/public/historia_escrito2_.pdf",
                            "fecha":"04/09/2025",
                            "referencia":"Folio:8 Certificación búsquedas",
                            "tramite":"Actuación Receptor"
                        },
                        {
                            "doc":"https://api-pjud.temposoft.cl/public/historia_escrito3_.pdf",
                            "fecha":"04/09/2025",
                            "referencia":"Folio:9 Certificación búsquedas",
                            "tramite":"Actuación Receptor"
                        }
                    ]
                }
            ],
            "fecha_ordena_exhorto":"22/07/2025",
            "fecha_ingreso_exhorto": "22/07/2025",
            "tribunal_destino":"1º Juzgado Civil de Temuco",
            "estado_exhorto":"Recepcionado"
        },
    # Inicio Actualización 15-09-2026. Cuando la causa es Exhorto tipo E. deberas mostrar esta pestaña
    "piezas_exhorto":[
        {
            "folio": "33", #Contempla que pueda venir vacio, con letras.
            "doc": "https://api-pjud.temposoft.cl/public/pieza_exhroto_1_.pdf", # contempla que pueda venir vacio.
            "cuaderno":"1",
            "anexo":[], # aun no tengo un ejemplo claro
            "etapa":"Tramitación Liquidación", # Contempla que se encuentre vacio.
            "tramite":"Resolución",
            "descripcion_tramite": "Ofíciese",
            "fecha_tramite": "08/09/2026",
            "foja":"31"

        },
        {
            "folio": "33", #Contempla que pueda venir vacio, con letras.
            "doc": "", # contempla que pueda venir vacio.
            "cuaderno":"1",
            "anexo":[], # aun no tengo un ejemplo claro
            "etapa":"", # Contempla que se encuentre vacio.
            "tramite":"",
            "descripcion_tramite": "Por publicada Res. de Liquidación",
            "fecha_tramite": "08/09/2026",
            "foja":"31"

        }
    ]
    ]

}
