source('modules/0_upload_data/upload_box.R')
source('modules/0_upload_data/dhis2_box.R')

uploadDataUI <- function(id, i18n) {
  ns <- NS(id)

  fluidRow(
    uploadBoxUI(ns('upload_box'), i18n) # ,
    # dhis2BoxUI(ns('dhis2_box'), i18n)
  )
}

uploadDataServer <- function(id, i18n) {
  moduleServer(
    id = id,
    module = function(input, output, session) {

      cache <- reactiveVal()

      dhis2_dt <- dhis2BoxServer('dhis2_box', i18n)
      upload_dt <- uploadBoxServer('upload_box', i18n)

      observeEvent(dhis2_dt(), {
        req(dhis2_dt())
        cache(dhis2_dt())
      })

      observeEvent(upload_dt(), {
        req(upload_dt())
        cache(upload_dt())
      })

      return(cache)
    }
  )
}
