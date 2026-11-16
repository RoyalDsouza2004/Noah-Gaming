import * as reportsService from '../services/reports.service.js';

export const getReportData = async (req, res, next) => {
  try {
    const reportType = req.params.reportType || req.query.type || 'revenue';
    const format = req.query.format || 'json';

    const result = await reportsService.exportReport(reportType, format, req.query);

    if (format === 'json') {
      return res.json({
        success: true,
        data: result.data,
      });
    }

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    if (result.isBinary && result.data?.length) {
      res.setHeader('Content-Length', result.data.length);
    }
    res.send(result.data);
  } catch (error) {
    next(error);
  }
};

export const exportReportEndpoint = async (req, res, next) => {
  try {
    const reportType = req.params.reportType || req.query.type || 'revenue';
    const format = req.query.format || 'csv';

    const result = await reportsService.exportReport(reportType, format, req.query);

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    if (result.isBinary && result.data?.length) {
      res.setHeader('Content-Length', result.data.length);
    }
    res.send(result.data);
  } catch (error) {
    next(error);
  }
};
