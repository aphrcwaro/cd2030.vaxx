source('ui/select-input.R')

adminLevelInputUI <- function(id, i18n, include_national = FALSE) {
  ns <- NS(id)

  choices <- c(
    if (include_national) c('National' = 'national') else NULL,
    'Admin 1' = 'adminlevel_1',
    'Admin 2' = 'district'
  )

  selectTooltipInput(ns('admin'), i18n = i18n, label = 'title_admin_level', 
                     tooltip = 'tooltip_amin_level', choices = choices)
}

adminLevelInputServer <- function(id, cache) {

  moduleServer(
    id = id,
    module = function(input, output, session) {
      selected <- selectTooltipServer('admin')
      return(selected)
    }
  )
}
