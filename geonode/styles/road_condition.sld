<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>road_condition</Name>
    <UserStyle>
      <Title>Pavement Condition by IRI</Title>
      <Abstract>Roads coloured by condition class from IRI (m/km). Uganda MoWT/DNR.</Abstract>
      <FeatureTypeStyle>
        <!-- Good: IRI < 3.5 -->
        <Rule>
          <Title>Good (IRI &lt; 3.5)</Title>
          <ogc:Filter><ogc:PropertyIsLessThan><ogc:PropertyName>iri</ogc:PropertyName><ogc:Literal>3.5</ogc:Literal></ogc:PropertyIsLessThan></ogc:Filter>
          <LineSymbolizer><Stroke><CssParameter name="stroke">#22c55e</CssParameter><CssParameter name="stroke-width">2.6</CssParameter></Stroke></LineSymbolizer>
        </Rule>
        <!-- Fair: 3.5–6.5 -->
        <Rule>
          <Title>Fair (IRI 3.5–6.5)</Title>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo><ogc:PropertyName>iri</ogc:PropertyName><ogc:Literal>3.5</ogc:Literal></ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan><ogc:PropertyName>iri</ogc:PropertyName><ogc:Literal>6.5</ogc:Literal></ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <LineSymbolizer><Stroke><CssParameter name="stroke">#ffd23f</CssParameter><CssParameter name="stroke-width">2.4</CssParameter></Stroke></LineSymbolizer>
        </Rule>
        <!-- Poor: 6.5–9.0 -->
        <Rule>
          <Title>Poor (IRI 6.5–9.0)</Title>
          <ogc:Filter><ogc:And>
            <ogc:PropertyIsGreaterThanOrEqualTo><ogc:PropertyName>iri</ogc:PropertyName><ogc:Literal>6.5</ogc:Literal></ogc:PropertyIsGreaterThanOrEqualTo>
            <ogc:PropertyIsLessThan><ogc:PropertyName>iri</ogc:PropertyName><ogc:Literal>9.0</ogc:Literal></ogc:PropertyIsLessThan>
          </ogc:And></ogc:Filter>
          <LineSymbolizer><Stroke><CssParameter name="stroke">#f97316</CssParameter><CssParameter name="stroke-width">2.4</CssParameter></Stroke></LineSymbolizer>
        </Rule>
        <!-- Very Poor / Bad: IRI >= 9.0 -->
        <Rule>
          <Title>Very Poor (IRI &#8805; 9.0)</Title>
          <ogc:Filter><ogc:PropertyIsGreaterThanOrEqualTo><ogc:PropertyName>iri</ogc:PropertyName><ogc:Literal>9.0</ogc:Literal></ogc:PropertyIsGreaterThanOrEqualTo></ogc:Filter>
          <LineSymbolizer><Stroke><CssParameter name="stroke">#ef4444</CssParameter><CssParameter name="stroke-width">2.8</CssParameter></Stroke></LineSymbolizer>
        </Rule>
        <Rule>
          <Title>Unsurveyed</Title>
          <ElseFilter/>
          <LineSymbolizer><Stroke><CssParameter name="stroke">#64748b</CssParameter><CssParameter name="stroke-width">1.2</CssParameter><CssParameter name="stroke-dasharray">4 3</CssParameter></Stroke></LineSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
