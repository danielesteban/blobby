import {
  Color,
  Mesh,
  PlaneGeometry,
  ShaderLib,
  ShaderMaterial,
  UniformsUtils,
} from 'three';

class Ocean extends Mesh {
  static setupGeometry() {
    const geometry = new PlaneGeometry(10000, 10000, 1, 1);
    geometry.deleteAttribute('normal');
    geometry.deleteAttribute('uv');
    geometry.rotateX(Math.PI * -0.5);
    Ocean.geometry = geometry;
  }

  static setupMaterial() {
    const { uniforms, vertexShader, fragmentShader } = ShaderLib.basic;
    Ocean.material = new ShaderMaterial({
      uniforms: {
        ...UniformsUtils.clone(uniforms),
        diffuse: { value: new Color(0x112233) },
      },
      vertexShader: vertexShader
        .replace(
          '#include <fog_pars_vertex>',
          [
            'varying vec3 vPos;',
          ].join('\n')
        )
        .replace(
          '#include <fog_vertex>',
          [
            'vPos = transformed.xyz;',
          ].join('\n')
        ),
      fragmentShader: fragmentShader
        .replace(
          '#include <fog_pars_fragment>',
          [
            'varying vec3 vPos;',
            'const vec3 fogColor = vec3(0.2863675817714411);',
            'const float fogDensity = 0.002;',
          ].join('\n')
        )
        .replace(
          '#include <fog_fragment>',
          [
            'float vFogDepth = length(vPos);',
            'float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );',
            'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );',
          ].join('\n')
        ),
    });
  }

  constructor() {
    if (!Ocean.geometry) {
      Ocean.setupGeometry();
    }
    if (!Ocean.material) {
      Ocean.setupMaterial();
    }
    super(Ocean.geometry, Ocean.material);
  }
}

export default Ocean;
