adminLevelInputUI <- function(id, i18n, include_national = FALSE) {
  ns <- NS(id)

  choices <- c(
    if (include_national) c('National' = 'national') else NULL,
    'Admin Level 1' = 'adminlevel_1',
    'District' = 'district'
  )

  selectizeInput(
    ns('admin_level'),
    label = i18n$t('title_admin_level'),
    choices = choices
  )
}

adminLevelInputServer <- function(id) {

  moduleServer(
    id = id,
    module = function(input, output, session) {
      return(reactive(input$admin_level))
    }
  )
}
