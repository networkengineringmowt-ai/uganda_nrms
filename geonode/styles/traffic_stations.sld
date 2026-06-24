<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>traffic_stations</Name>
    <UserStyle>
      <Title>Traffic / Enforcement Stations</Title>
      <Abstract>Point stations (ATC = cyan square, manual/other = yellow circle).</Abstract>
      <FeatureTypeStyle>
        <Rule>
          <Title>ATC (Automatic)</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>type</ogc:PropertyName><ogc:Literal>ATC</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <PointSymbolizer><Graphic><Mark><WellKnownName>square</WellKnownName><Fill><CssParameter name="fill">#00f5ff</CssParameter></Fill><Stroke><CssParameter name="stroke">#04293a</CssParameter><CssParameter name="stroke-width">0.8</CssParameter></Stroke></Mark><Size>12</Size></Graphic></PointSymbolizer>
        </Rule>
        <Rule>
          <Title>Manual / Other Station</Title>
          <ElseFilter/>
          <PointSymbolizer><Graphic><Mark><WellKnownName>circle</WellKnownName><Fill><CssParameter name="fill">#ffd23f</CssParameter></Fill><Stroke><CssParameter name="stroke">#3a2e04</CssParameter><CssParameter name="stroke-width">0.8</CssParameter></Stroke></Mark><Size>9</Size></Graphic></PointSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
