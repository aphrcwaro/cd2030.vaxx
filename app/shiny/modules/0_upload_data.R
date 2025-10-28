source('modules/0_upload_data/upload_box.R')

uploadDataUI <- function(id, i18n) {
  ns <- NS(id)

  fluidRow(
    uploadBoxUI(ns('upload_box'), i18n)
  )
}

uploadDataServer <- function(id, i18n) {
  moduleServer(
    id = id,
    module = function(input, output, session) {

      cache <- reactiveVal()

      upload_dt <- uploadBoxServer('upload_box', i18n)

      observeEvent(upload_dt(), {
        req(upload_dt())
        cache(upload_dt())
      })

      return(cache)
    }
  )
}
