<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>bridges</Name>
    <UserStyle>
      <Title>Bridges by Condition Rating</Title>
      <Abstract>Bridge points coloured by condition rating (1 critical – 5 very good).</Abstract>
      <FeatureTypeStyle>
        <Rule>
          <Title>Critical (1)</Title>
          <ogc:Filter><ogc:PropertyIsLessThanOrEqualTo><ogc:PropertyName>condition</ogc:PropertyName><ogc:Literal>1</ogc:Literal></ogc:PropertyIsLessThanOrEqualTo></ogc:Filter>
          <PointSymbolizer><Graphic><Mark><WellKnownName>triangle</WellKnownName><Fill><CssParameter name="fill">#ef4444</CssParameter></Fill><Stroke><CssParameter name="stroke">#ffffff</CssParameter><CssParameter name="stroke-width">0.6</CssParameter></Stroke></Mark><Size>13</Size></Graphic></PointSymbolizer>
        </Rule>
        <Rule>
          <Title>Poor (2)</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>condition</ogc:PropertyName><ogc:Literal>2</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PointSymbolizer><Graphic><Mark><WellKnownName>circle</WellKnownName><Fill><CssParameter name="fill">#f97316</CssParameter></Fill><Stroke><CssParameter name="stroke">#ffffff</CssParameter><CssParameter name="stroke-width">0.6</CssParameter></Stroke></Mark><Size>11</Size></Graphic></PointSymbolizer>
        </Rule>
        <Rule>
          <Title>Fair (3)</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>condition</ogc:PropertyName><ogc:Literal>3</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PointSymbolizer><Graphic><Mark><WellKnownName>circle</WellKnownName><Fill><CssParameter name="fill">#ffd23f</CssParameter></Fill><Stroke><CssParameter name="stroke">#ffffff</CssParameter><CssParameter name="stroke-width">0.6</CssParameter></Stroke></Mark><Size>10</Size></Graphic></PointSymbolizer>
        </Rule>
        <Rule>
          <Title>Good / Very Good (4–5)</Title>
          <ogc:Filter><ogc:PropertyIsGreaterThanOrEqualTo><ogc:PropertyName>condition</ogc:PropertyName><ogc:Literal>4</ogc:Literal></ogc:PropertyIsGreaterThanOrEqualTo></ogc:Filter>
          <PointSymbolizer><Graphic><Mark><WellKnownName>circle</WellKnownName><Fill><CssParameter name="fill">#22c55e</CssParameter></Fill><Stroke><CssParameter name="stroke">#ffffff</CssParameter><CssParameter name="stroke-width">0.6</CssParameter></Stroke></Mark><Size>10</Size></Graphic></PointSymbolizer>
        </Rule>
        <Rule>
          <Title>Unrated</Title>
          <ElseFilter/>
          <PointSymbolizer><Graphic><Mark><WellKnownName>circle</WellKnownName><Fill><CssParameter name="fill">#94a3b8</CssParameter></Fill><Stroke><CssParameter name="stroke">#ffffff</CssParameter><CssParameter name="stroke-width">0.5</CssParameter></Stroke></Mark><Size>8</Size></Graphic></PointSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
