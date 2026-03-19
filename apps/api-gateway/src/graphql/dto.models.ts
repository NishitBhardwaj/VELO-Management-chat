import { InputType, Field, ObjectType, Int } from '@nestjs/graphql';

@ObjectType()
export class UserContext {
    @Field()
    id: string;

    @Field()
    email: string;

    @Field()
    display_name: string;

    @Field({ nullable: true })
    avatar_url?: string;
}

@ObjectType()
export class AuthResponseContext {
    @Field()
    access_token: string;

    @Field(() => UserContext)
    user: UserContext;
}

@InputType()
export class LoginInput {
    @Field()
    email: string;

    @Field()
    password: string;
}

@InputType()
export class RegisterInput {
    @Field()
    email: string;

    @Field()
    password: string;

    @Field()
    display_name: string;

    @Field({ nullable: true })
    phone?: string;
}

@InputType()
export class AttendanceCommand {
    @Field()
    message: string;
}

@InputType()
export class BroadcastCommand {
    @Field()
    message: string;
}
