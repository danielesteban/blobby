import {
  Color,
  MathUtils,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';

const _from = new Vector3();
const _to = new Vector3();
const _offset = new Vector3();
const _voxel = new Vector3();
const _matrix = new Matrix4();
const _forward = new Vector3();
const _right = new Vector3();
const _target = new Vector3();
const _up = new Vector3(0, 1, 0);

class Blobby {
  constructor({ operations, shapes }, volume) {
    const limbs = 9;
    const entity = ({ color, scale, shape = shapes.sphere }) => ({
      color,
      operation: operations.union,
      position: this.position.clone(),
      rotation: new Quaternion(0, 0, 0, 1),
      scale,
      shape,
    });
    const palette = {
      head: new Color(Math.random() * 0xFFFFFF),
      eyes: new Color(Math.random() * 0xFFFFFF),
      feet: new Color(Math.random() * 0xFFFFFF),
      legsBottom: new Color(Math.random() * 0xFFFFFF),
      legsTop: new Color(Math.random() * 0xFFFFFF),
    };
    this.position = new Vector3(volume.width * 0.5 + 0.5, volume.height - 1, volume.depth * 0.5 + 0.5);
    this.position.y = volume.ground(_voxel.copy(this.position).floor(), 4);
    this.head = entity({
      color: palette.head,
      position: new Vector3(volume.width * 0.5 + 0.5, volume.height - 1, volume.depth * 0.5 + 0.5),
      scale: new Vector3(2, 2, 2),
    });
    this.eyes = [
      entity({ color: palette.eyes, scale: new Vector3(1.5, 1.5, 1.5) }),
      entity({ color: palette.eyes, scale: new Vector3(1.5, 1.5, 1.5) }),
    ];
    this.feet = Array.from({ length: limbs }, (v, i) => {
      const foot = entity({ color: palette.feet, scale: new Vector3(0.1 + Math.random() * 0.2, 0.1 + Math.random() * 0.2, 0.1 + Math.random() * 0.2) });
      foot.target = foot.position.clone();
      return foot;
    });
    this.legsBottom = Array.from({ length: limbs }, () => entity({
      color: palette.legsBottom,
      scale: new Vector3(Math.random() * 0.2, 0, 0),
      shape: shapes.capsule,
    }));
    this.legsTop = Array.from({ length: limbs }, () => entity({
      color: palette.legsTop,
      scale: new Vector3(Math.random() * 0.2, 0, 0),
      shape: shapes.capsule,
    }));

    this.entities = [this.head, ...this.eyes, ...this.feet, ...this.legsBottom, ...this.legsTop];
    this.volume = volume;
  }

  onAnimationTick(delta, time) {
    const {
      head,
      eyes,
      feet,
      legsBottom,
      legsTop,
      path,
      position,
      volume,
    } = this;
    head.scale.setScalar(2.5 + Math.sin(time * 4) * 0.25);
    if (path) {
      path.step = Math.min(path.step + delta * 8, path.positions.length - 1);
      const step = Math.floor(Math.min(path.step, path.positions.length - 2));
      position.lerpVectors(path.positions[step], path.positions[step + 1], path.step % 1);
      head.position.copy(position);
      head.position.y += head.scale.y + 2;
      if (path.step === path.positions.length - 1) {
        this.path = null;
      }
    }
    eyes.forEach((eye, i) => {
      eye.scale.setScalar(head.scale.x * 0.5);
      eye.position.copy(head.position);
      eye.position.y += 1.5;
      const a = time + i * Math.PI;
      eye.position.x += Math.sin(a);
      eye.position.z += Math.cos(a);
    });
    feet.forEach((foot, i) => {
      const d = foot.target.distanceTo(position);
      if (d > 10) {
        for (let attempt = 0; attempt < 10; attempt++) {
          _offset.set(0.5 + Math.random(), Math.random(), 0.5 + Math.random());
          if (Math.random() > 0.5) _offset.x *= -1;
          if (Math.random() > 0.5) _offset.z *= -1;
          _voxel.copy(position).addScaledVector(_offset, 5).floor();
          _voxel.y = volume.ground(_voxel, 4);
          if (_voxel.y > 0) {
            _voxel.y += foot.scale.y;
            _voxel.x += 0.5;
            _voxel.z += 0.5;
            if (!feet.find((f) => f.target.distanceTo(_voxel) <= 4)) {
              foot.target.copy(_voxel);
              break;
            }
          }
        }
      }
      foot.scale.setScalar(0.3 + Math.sin(time * 2 + i) * 0.2);
      foot.position.x = MathUtils.damp(foot.position.x, foot.target.x, 4, delta);
      foot.position.y = MathUtils.damp(foot.position.y, foot.target.y, 4, delta);
      foot.position.z = MathUtils.damp(foot.position.z, foot.target.z, 4, delta);
      legsTop[i].scale.x = foot.scale.x;
      [legsBottom[i], legsTop[i]].forEach((limb, i) => {
        if (i === 0) {
          _from.copy(foot.position);
          _to.copy(foot.position).addScaledVector(_up, 2).add(head.position).multiplyScalar(0.5);
        } else {
          _from.copy(_to);
          _to.copy(head.position);
        }
        limb.position.addVectors(_from, _to).multiplyScalar(0.5);
        _forward.subVectors(_from, _to);
        limb.scale.y = _forward.length();
        _forward.normalize();
        _right.crossVectors(_forward, _up).normalize();
        _target.crossVectors(_right, _forward).add(limb.position);
        _matrix.lookAt(_target, limb.position, _up);
        limb.rotation.setFromRotationMatrix(_matrix);
      });
    });
  }

  moveTo(destination) {
    const { position, volume } = this;
    _from.copy(position).floor();
    _to.copy(destination).floor();
    _to.y = Math.min(_to.y, volume.height - 1);
    _to.y = volume.ground(_to, 4);
    if (_to.y > 0) {
      const results = volume.pathfind({
        from: _from,
        to: _to,
        height: 4,
      });
      if (results.length > 3) {
        const positions = [position.clone()];
        for (let i = 3, l = results.length; i < l; i += 3) {
          const isDestination = i === l - 3;
          positions.push(new Vector3(
            results[i] + (isDestination ? 0.5 : 0.25 + Math.random() * 0.5),
            results[i + 1],
            results[i + 2] + (isDestination ? 0.5 : 0.25 + Math.random() * 0.5)
          ));
        }
        this.path = { positions, step: 0 };
        return positions[positions.length - 1];
      }
    }
    return false;
  }
}

export default Blobby;
