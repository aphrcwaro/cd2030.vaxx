indicatorSelect <- function(id, i18n, label = NULL) {
  ns <- NS(id)
  selectizeInput(ns('select'),
                 label = if (is.null(label)) i18n$t('title_indicator') else i18n$t(label),
                 choices = c('Select Indicator' = '', get_all_indicators()))
}

indicatorSelectServer <- function(id, cache) {
  stopifnot(is.reactive(cache))
  
  moduleServer(
    id = id,
    module = function(input, output, session) {
      observe({
        req(cache())
        updateSelectizeInput(session, 'select', choices = c('Select Indicator' = '', get_all_indicators()))
      })
      
      return(reactive(input$select))
    }
  )
}