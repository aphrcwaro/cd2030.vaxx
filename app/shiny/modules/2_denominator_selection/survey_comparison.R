surveyComparisonUI <- function(id, i18n) {
  ns <- NS(id)

  tabBox(
    title = i18n$t('title_national_coverage'),
    width = 12,
    
    tabPanel(title = i18n$t("opt_ideliv"), downloadCoverageUI(ns('ideliv'))),
    tabPanel(title = i18n$t("opt_bcg"), downloadCoverageUI(ns('bcg'))),
    tabPanel(title = i18n$t("opt_penta3"), downloadCoverageUI(ns('penta3'))),
    tabPanel(title = i18n$t("opt_mcv1"), downloadCoverageUI(ns('measles1')))
  )
}

surveyComparisonServer <- function(id, cache, i18n) {
  stopifnot(is.reactive(cache))

  moduleServer(
    id = id,
    module = function(input, output, session) {

      denominatorInputServer('denominator', cache, i18n, allowInput = TRUE)

      survey_estimates <- reactive({
        req(cache())
        cache()$survey_estimates
      })

      indicator_coverage <- reactive({
        req(cache(), cache()$check_inequality_params)
        cache()$indicator_coverage_national
      })

      ideliv_coverage <- reactive({
        req(indicator_coverage(), cache()$survey_year)
        ideliv_rate <- unname(survey_estimates()['ideliv'])
        indicator_coverage() %>%
          filter_indicator_coverage('instdeliveries', ideliv_rate, cache()$survey_year)
      })

      penta3_coverage <- reactive({
        req(indicator_coverage(), cache()$survey_year)
        penta3_rate <- unname(survey_estimates()['penta3'])
        indicator_coverage() %>%
          filter_indicator_coverage('penta3', penta3_rate, cache()$survey_year)
      })

      measles1_coverage <- reactive({
        req(indicator_coverage(), cache()$survey_year)
        measles1_rate <- unname(survey_estimates()['measles1'])
        indicator_coverage() %>%
          filter_indicator_coverage('measles1', measles1_rate, cache()$survey_year)
      })

      bcg_coverage <- reactive({
        req(indicator_coverage(), cache()$survey_year)
        bcg_rate <- unname(survey_estimates()['bcg'])
        indicator_coverage() %>%
          filter_indicator_coverage('bcg', bcg_rate, cache()$survey_year)
      })

      downloadCoverageServer(
        id = 'ideliv',
        filename = reactive('ideliv_denominator'),
        data_fn = ideliv_coverage,
        sheet_name = reactive(i18n$t("title_ideliv")),
        i18n = i18n
      )

      downloadCoverageServer(
        id = 'penta3',
        filename = reactive('penta3_denominator'),
        data_fn = penta3_coverage,
        sheet_name = reactive(i18n$t('title_penta3')),
        i18n = i18n
      )

      downloadCoverageServer(
        id = 'measles1',
        filename = reactive('measles1_denominator'),
        data_fn = measles1_coverage,
        sheet_name = reactive(i18n$t('title_measles1')),
        i18n = i18n
      )

      downloadCoverageServer(
        id = 'bcg',
        filename = reactive('bcg_denominator'),
        data_fn = bcg_coverage,
        sheet_name = reactive(i18n$t('title_bcg')),
        i18n = i18n
      )
    }
  )
}
