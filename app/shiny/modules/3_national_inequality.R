nationalInequalityUI <- function(id, i18n) {
  ns <- NS(id)

  countdownDashboard(
    dashboardId = ns('national_inequality'),
    dashboardTitle = i18n$t('title_national_inequality'),
    i18n = i18n,

    countdownOptions = countdownOptions(
      title = i18n$t('title_analysis_options'),
      column(3, adminLevelInputUI(ns('admin_level'), i18n)),
      column(3, denominatorInputUI(ns('denominator'), i18n))
    ),

    tabBox(
      title = i18n$t('title_national_inequality'),
      width = 12,

      tabPanel(title = i18n$t('opt_penta3'), downloadCoverageUI(ns('penta3'))),
      tabPanel(title = i18n$t('opt_mcv1'), downloadCoverageUI(ns('measles1'))),
      tabPanel(
        title = i18n$t('opt_custom_check'),
        fluidRow(
          column(3, indicatorSelect(ns('indicator'), i18n))
        ),
        downloadCoverageUI(ns('custom'))
      )
    )
  )
}

nationalInequalityServer <- function(id, cache, i18n) {
  stopifnot(is.reactive(cache))

  moduleServer(
    id = id,
    module = function(input, output, session) {

      indicator <- indicatorSelectServer('indicator', cache)
      denominatorInputServer('denominator', cache, i18n)
      admin_level <- adminLevelInputServer('admin_level')

      inequalities <- reactive({
        req(cache(), cache()$check_inequality_params, admin_level())
        cache()$calculate_inequality(admin_level = admin_level())
      })

      penta3_inequality <- reactive({
        req(inequalities())
        inequalities() %>%
          filter_inequality(indicator = 'penta3', denominator = cache()$get_denominator('penta3'))
      })

      measles1_inequality <- reactive({
        req(inequalities())
        inequalities() %>%
          filter_inequality(indicator = 'measles1', denominator = cache()$get_denominator('measles1'))
      })

      custom_inequality <- reactive({
        req(inequalities(), indicator())
        inequalities() %>%
          filter_inequality(indicator = indicator(), denominator = cache()$get_denominator(indicator()))
      })

      downloadCoverageServer(
        id = 'measles1',
        filename = reactive(paste0('measles1_', admin_level(), '_inequality_', cache()$get_denominator('measles1'))),
        data_fn = measles1_inequality,
        i18n = i18n,
        sheet_name = reactive(i18n$t('title_mcv1_inequality'))
      )

      downloadCoverageServer(
        id = 'penta3',
        filename = reactive(paste0('penta3', admin_level(), '_inequality_', cache()$get_denominator('penta3'))),
        data_fn = penta3_inequality,
        i18n = i18n,
        sheet_name = reactive(i18n$t('title_penta3_inequality'))
      )

      downloadCoverageServer(
        id = 'custom',
        filename = reactive(paste0(indicator(), '_', admin_level(), '_inequality_', cache()$get_denominator(indicator()))),
        data_fn = custom_inequality,
        i18n = i18n,
        sheet_name = reactive(paste0(indicator(), ' Inequality'))
      )

      countdownHeaderServer(
        'national_inequality',
        cache = cache,
        path = 'national-inequality',
        i18n = i18n
      )
    }
  )
}
