<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>road_network</Name>
    <UserStyle>
      <Title>National Road Network by Class</Title>
      <Abstract>Roads coloured by functional class (A/B/C/M). Uganda MoWT/DNR.</Abstract>
      <FeatureTypeStyle>
        <!-- Class A — primary national (red) -->
        <Rule>
          <Title>Class A — National (Primary)</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>road_class</ogc:PropertyName><ogc:Literal>A</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <LineSymbolizer><Stroke><CssParameter name="stroke">#ff3366</CssParameter><CssParameter name="stroke-width">3</CssParameter></Stroke></LineSymbolizer>
        </Rule>
        <!-- Class B — regional (orange) -->
        <Rule>
          <Title>Class B — Regional</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>road_class</ogc:PropertyName><ogc:Literal>B</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <LineSymbolizer><Stroke><CssParameter name="stroke">#ff6b35</CssParameter><CssParameter name="stroke-width">2.4</CssParameter></Stroke></LineSymbolizer>
        </Rule>
        <!-- Class C — district (yellow) -->
        <Rule>
          <Title>Class C — District</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>road_class</ogc:PropertyName><ogc:Literal>C</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <LineSymbolizer><Stroke><CssParameter name="stroke">#ffd23f</CssParameter><CssParameter name="stroke-width">1.8</CssParameter></Stroke></LineSymbolizer>
        </Rule>
        <!-- Class M — community / other (grey-purple) -->
        <Rule>
          <Title>Class M — Community / Other</Title>
          <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>road_class</ogc:PropertyName><ogc:Literal>M</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
          <LineSymbolizer><Stroke><CssParameter name="stroke">#b967ff</CssParameter><CssParameter name="stroke-width">1.4</CssParameter></Stroke></LineSymbolizer>
        </Rule>
        <!-- Fallback -->
        <Rule>
          <Title>Other</Title>
          <ElseFilter/>
          <LineSymbolizer><Stroke><CssParameter name="stroke">#8aa0b8</CssParameter><CssParameter name="stroke-width">1.2</CssParameter></Stroke></LineSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
