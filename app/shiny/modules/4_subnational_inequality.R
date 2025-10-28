subnationalInequalityUI <- function(id, i18n) {
  ns <- NS(id)

  countdownDashboard(
    dashboardId = ns('subnational_inequality'),
    dashboardTitle = i18n$t('title_subnational_inequality'),
    i18n = i18n,

    countdownOptions(
      title = i18n$t('title_options'),
      column(3, denominatorInputUI(ns('denominator'), i18n)),
      column(3, regionInputUI(ns('region'), i18n))
    ),

    tabBox(
      title = i18n$t('title_subnational_inequality'),
      width = 12,

      tabPanel(title = i18n$t('opt_penta3'), downloadCoverageUI(ns('penta3'))),
      tabPanel(title = i18n$t('opt_mcv1'), downloadCoverageUI(ns('measles1'))),
      tabPanel(title = i18n$t("title_penta13_dropout"), downloadCoverageUI(ns('dropout_penta13'))),
      tabPanel(title = i18n$t("title_penta3_mcv1_dropout"), downloadCoverageUI(ns('dropout_penta3mcv1'))),
      tabPanel(
        title = i18n$t("opt_custom_check"),
        fluidRow(
          column(3, indicatorSelect(ns('indicator'), i18n, indicators = get_analysis_indicators()))
        ),
        downloadCoverageUI(ns('custom'))
      )
    )
  )
}

subnationalInequalityServer <- function(id, cache, i18n) {
  stopifnot(is.reactive(cache))

  moduleServer(
    id = id,
    module = function(input, output, session) {

      denominatorInputServer('denominator', cache, i18n)
      region <- regionInputServer('region', cache, reactive('adminlevel_1'), i18n)
      indicator <- indicatorSelectServer('indicator')

      inequalities <- reactive({
        req(cache(), cache()$check_inequality_params, region())
        cache()$calculate_inequality(admin_level = 'adminlevel_1', region = region())
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
      
      dropout_penta13_inequality <- reactive({
        req(inequalities())
        inequalities() %>%
          filter_inequality(indicator = 'dropout_penta13', denominator = cache()$get_denominator('dropout_penta13'))
      })
      
      dropout_penta3mcv1_inequality <- reactive({
        req(inequalities())
        inequalities() %>%
          filter_inequality(indicator = 'dropout_penta3mcv1', denominator = cache()$get_denominator('dropout_penta3mcv1'))
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
        id = 'dropout_penta13',
        filename = reactive(paste0('dropout_penta13_', admin_level(), '_inequality_', cache()$get_denominator('dropout_penta13'))),
        data_fn = dropout_penta13_inequality,
        i18n = i18n,
        sheet_name = reactive(i18n$t('title_penta13_dropout'))
      )
      
      downloadCoverageServer(
        id = 'dropout_penta3mcv1',
        filename = reactive(paste0('dropout_penta3mcv1', admin_level(), '_inequality_', cache()$get_denominator('dropout_penta3mcv1'))),
        data_fn = dropout_penta3mcv1_inequality,
        i18n = i18n,
        sheet_name = reactive(i18n$t('title_penta3_mcv1_dropout'))
      )

      downloadCoverageServer(
        id = 'custom',
        filename = reactive(paste0(indicator(), '_admin_level_inequality_', cache()$get_denominator(indicator()))),
        data_fn = custom_inequality,
        i18n = i18n,
        sheet_name = reactive(paste0(indicator(), ' Inequality'))
      )

      countdownHeaderServer(
        'subnational_inequality',
        cache = cache,
        path = 'subnational-inequality',
        i18n = i18n
      )
    }
  )
}
