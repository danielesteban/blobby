import {
  BoxGeometry,
  Color,
  Mesh,
  ShaderLib,
  ShaderMaterial,
  UniformsUtils,
} from 'three';

class Indicator extends Mesh {
  static setupGeometry() {
    const geometry = new BoxGeometry(0.5, 0.5, 0.5);
    geometry.deleteAttribute('uv');
    geometry.translate(0, 0.25, 0);
    Indicator.geometry = geometry;
  }

  static setupMaterial() {
    const { uniforms, vertexShader, fragmentShader } = ShaderLib.basic;
    Indicator.material = new ShaderMaterial({
      vertexColors: true,
      uniforms: {
        ...UniformsUtils.clone(uniforms),
        diffuse: { value: new Color(0xFF0000) },
      },
      vertexShader: vertexShader
        .replace(
          '#include <common>',
          [
            '#include <common>',
            'varying vec3 fragNormal;',
          ].join('\n')
        )
        .replace(
          '#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )',
          '#if 1'
        )
        .replace(
          '#include <begin_vertex>',
          [
            '#include <begin_vertex>',
            'fragNormal = transformedNormal;',
          ].join('\n')
        ),
      fragmentShader: fragmentShader
        .replace(
          '#include <common>',
          [
            '#include <common>',
            'layout(location = 1) out vec4 pc_fragNormal;',
            'varying vec3 fragNormal;',
          ].join('\n')
        )
        .replace(
          '#include <dithering_fragment>',
          [
            '#include <dithering_fragment>',
            'pc_fragNormal = vec4(normalize(fragNormal), 0.0);',
          ].join('\n')
        ),
    });
  }

  constructor() {
    if (!Indicator.geometry) {
      Indicator.setupGeometry();
    }
    if (!Indicator.material) {
      Indicator.setupMaterial();
    }
    super(Indicator.geometry, Indicator.material);
  }
}

export default Indicator;
