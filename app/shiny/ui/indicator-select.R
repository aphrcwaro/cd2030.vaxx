source('ui/select-input.R')

indicatorSelect <- function(id, i18n, label = NULL, tooltip = NULL, indicators = NULL) {
  ns <- NS(id)
  label <- if (is.null(label)) 'title_indicator' else label
  indicators <- indicators %||% get_all_indicators()
  selectTooltipInput(ns('indicator'), i18n = i18n, label = label, tooltip = tooltip, choices = indicators)
}

indicatorSelectServer <- function(id) {
  moduleServer(id = id, module = function(input, output, session) {
    selected <- selectTooltipServer('indicator')
    return(selected)
  }
  )
}

