source('modules/2_denominator_selection/coverage_trends.R')
source('modules/2_denominator_selection/survey_comparison.R')

denominatorSelectionUI <- function(id, i18n) {
  ns <- NS(id)

  countdownDashboard(
    dashboardId = ns('denominator_selection'),
    dashboardTitle = i18n$t('title_denominator_selection'),
    i18n = i18n,

    countdownOptions = countdownOptions(
      title = i18n$t('title_options'),
      column(3, denominatorInputUI(ns('denominator'), i18n)),
      column(3, adminLevelInputUI(ns('admin_level'), i18n, include_national = TRUE)),
      column(3, uiOutput(ns('region_ui')))
    ),

    include_report = TRUE,
    
    coverageTrendsUI(ns('coverage'), i18n),
    surveyComparisonUI(ns('survey'), i18n)
  )
}

denominatorSelectionServer <- function(id, cache, i18n) {
  stopifnot(is.reactive(cache))

  moduleServer(
    id = id,
    module = function(input, output, session) {

      admin_level <- adminLevelInputServer('admin_level')
      region <- regionInputServer('region', cache, admin_level, i18n)
      denominatorInputServer('denominator', cache, i18n, allowInput = TRUE)
      
      coverageTrendsServer('coverage', cache, admin_level, region, i18n)
      surveyComparisonServer('survey', cache, i18n)
      
      countdownHeaderServer(
        'denominator_selection',
        cache = cache,
        path = 'denominator-assessment',
        section = 'sec-denominator-selection',
        i18n = i18n
      )
    }
  )
}
