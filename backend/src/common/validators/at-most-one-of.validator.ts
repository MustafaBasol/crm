import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function AtMostOneOf(
  properties: string[],
  validationOptions?: ValidationOptions,
) {
  return function atMostOneOfDecorator(object: object, propertyName: string) {
    registerDecorator({
      name: 'AtMostOneOf',
      target: object.constructor,
      propertyName,
      constraints: [properties],
      options: validationOptions,
      validator: {
        validate(_: unknown, args: ValidationArguments) {
          const [props] = args.constraints as [string[]];
          const dto = args.object as Record<string, unknown>;

          const count = props.reduce((acc, key) => {
            const value = dto[key];
            if (value === undefined || value === null) return acc;
            if (typeof value === 'string' && value.trim() === '') return acc;
            return acc + 1;
          }, 0);

          return count <= 1;
        },
        defaultMessage(args: ValidationArguments) {
          const [props] = args.constraints as [string[]];
          return `Provide only one of ${props.join(', ')}`;
        },
      },
    });
  };
}
