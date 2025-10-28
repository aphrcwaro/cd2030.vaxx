source('ui/select-input.R')

populationSelect <- function(id, i18n) {
  ns <- NS(id)
  
  choices <- c(
    'Live births DHIS2' = 'totlivebirths_dhis2', 
    'Total births DHIS2' = 'totbirths_dhis2',
    'Total births UN' = 'un_births', 
    'Total Population DHIS2' = 'totpop_dhis2',
    'Total Population UN' = 'un_population', 
    'Under 1 DHIS2' = 'totunder1_dhis2', 
    'Under 1 UN' = 'un_under1'
  )
  selectTooltipInput(ns('population'), i18n = i18n, label = 'title_population_select', 
                     tooltip = 'tooltip_population_select', choices = choices)
}

populationSelectServer <- function(id, cache) {
  stopifnot(is.reactive(cache))
  
  moduleServer(id = id, module = function(input, output, session) {
    
    population <- reactive({
      req(cache())
      cache()$derivation_population
    })
    
    selected <- selectTooltipServer('population', population)
    
    observe({
      req(cache(), selected())
      cache()$set_derivation_population(selected())
    })
    
    return(selected)
  }
  )
}

